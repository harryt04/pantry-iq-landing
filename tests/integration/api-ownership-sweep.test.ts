import { makeSignature } from 'better-auth/crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import {
  closeAppDatabaseClient,
  integrationDatabaseEnabled,
  openTestDatabase,
  type OpenTestDatabase,
} from '../helpers/test-database'
import {
  buildRequest,
  callRoute,
  nextHeadersMock,
  setRequestHeaders,
} from '../helpers/api-request'

// Route handlers call Next's ambient headers() API. This is the test-runtime
// adapter; the request, auth cookie, database, and every service remain real.
vi.mock('next/headers', () => nextHeadersMock())

const OWNER_ID = '00000000-0000-4000-8000-00000000a101'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000a102'
const OWNER_LOCATION_ID = '00000000-0000-4000-8000-00000000b101'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000b102'
const OTHER_ITEM_ID = '00000000-0000-4000-8000-00000000c102'
const OTHER_UPLOAD_ID = '00000000-0000-4000-8000-00000000d102'
const SESSION_TOKEN = 'api-ownership-sweep-session-token'
const SETUP_TIMEOUT_MS = 120_000

type RouteCase = {
  name: string
  invoke: () => Promise<{ status: number }>
}

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let cases: RouteCase[] = []

async function ownerHeaders() {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? 'local-development-secret-change-me'
  const signedToken = `${SESSION_TOKEN}.${await makeSignature(
    SESSION_TOKEN,
    secret,
  )}`
  return new Headers({
    cookie: `better-auth.session_token=${signedToken}`,
  })
}

function requestWithOwner(
  path: string,
  options: Parameters<typeof buildRequest>[1] = {},
) {
  return ownerHeaders().then((headers) => {
    setRequestHeaders(headers)
    return buildRequest(path, { ...options, headers })
  })
}

describe.skipIf(!integrationDatabaseEnabled())(
  'API ownership boundary sweep',
  () => {
    beforeAll(async () => {
      opened = await openTestDatabase()
      const { sql, url } = opened.database

      await rollbackDatabase(sql)
      await migrateDatabase(sql)

      previousDatabaseUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = url

      await sql`
      insert into "user" (id, name, email)
      values
        (${OWNER_ID}, 'Route Owner', 'route-owner@example.com'),
        (${OTHER_OWNER_ID}, 'Other Owner', 'other-owner@example.com')
    `
      await sql`
      insert into session (id, user_id, token, expires_at)
      values (
        '00000000-0000-4000-8000-00000000e101',
        ${OWNER_ID},
        ${SESSION_TOKEN},
        now() + interval '1 hour'
      )
    `
      await sql`
      insert into locations (id, user_id, name)
      values
        (${OWNER_LOCATION_ID}, ${OWNER_ID}, 'Owner Kitchen'),
        (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'Other Kitchen')
    `
      await sql`
      insert into inventory_items (
        id, location_id, canonical_name, display_name, unit, item_type
      ) values (
        ${OTHER_ITEM_ID}, ${OTHER_LOCATION_ID}, 'other item', 'Other Item',
        'each', 'ingredient'
      )
    `
      await sql`
      insert into csv_upload_history (
        id, location_id, filename, source, rows_imported, mapping_used,
        storage_key, status, uploaded_at
      ) values (
        ${OTHER_UPLOAD_ID}, ${OTHER_LOCATION_ID}, 'other.csv', 'transactions',
        0, '{"Item":"rawItemName"}'::jsonb, 'other/upload.csv', 'uploaded', now()
      )
    `

      const [
        chatMisses,
        chatOverride,
        chat,
        connectors,
        exports,
        items,
        item,
        location,
        locations,
        manualEntry,
        observability,
        recipes,
        reconciliation,
        uploadCommit,
        uploadMapping,
        uploadPreview,
        uploadHistory,
        uploads,
      ] = await Promise.all([
        import('../../app/api/chat/misses/route'),
        import('../../app/api/chat/override/route'),
        import('../../app/api/chat/route'),
        import('../../app/api/connectors/status/route'),
        import('../../app/api/exports/[exportType]/route'),
        import('../../app/api/items/route'),
        import('../../app/api/items/[itemId]/route'),
        import('../../app/api/locations/[locationId]/route'),
        import('../../app/api/locations/route'),
        import('../../app/api/manual-entry/route'),
        import('../../app/api/observability/route'),
        import('../../app/api/recipes/route'),
        import('../../app/api/reconciliation/route'),
        import('../../app/api/uploads/[uploadId]/commit/route'),
        import('../../app/api/uploads/[uploadId]/mapping/route'),
        import('../../app/api/uploads/[uploadId]/preview/route'),
        import('../../app/api/uploads/history/route'),
        import('../../app/api/uploads/route'),
      ])

      cases = [
        {
          name: 'GET /api/chat/misses',
          invoke: async () =>
            callRoute(
              chatMisses.GET,
              await requestWithOwner('/api/chat/misses', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'POST /api/chat/override',
          invoke: async () =>
            callRoute(
              chatOverride.POST,
              await requestWithOwner('/api/chat/override', {
                method: 'POST',
                body: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'POST /api/chat',
          invoke: async () =>
            callRoute(
              chat.POST,
              await requestWithOwner('/api/chat', {
                method: 'POST',
                body: {
                  locationId: OTHER_LOCATION_ID,
                  question: 'What changed?',
                },
              }),
            ),
        },
        {
          name: 'GET /api/connectors/status',
          invoke: async () =>
            callRoute(
              connectors.GET,
              await requestWithOwner('/api/connectors/status', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'GET /api/exports/transactions',
          invoke: async () =>
            callRoute(
              exports.GET,
              await requestWithOwner('/api/exports/transactions', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
              { exportType: 'transactions' },
            ),
        },
        {
          name: 'GET /api/items',
          invoke: async () =>
            callRoute(
              items.GET,
              await requestWithOwner('/api/items', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'PATCH /api/items/[itemId]',
          invoke: async () =>
            callRoute(
              item.PATCH,
              await requestWithOwner('/api/items', {
                method: 'PATCH',
                query: { locationId: OTHER_LOCATION_ID },
                body: { displayName: 'Other Item Mutated' },
              }),
              { itemId: OTHER_ITEM_ID },
            ),
        },
        {
          name: 'GET /api/locations/[locationId]',
          invoke: async () =>
            callRoute(
              location.GET,
              await requestWithOwner(`/api/locations/${OTHER_LOCATION_ID}`),
              { locationId: OTHER_LOCATION_ID },
            ),
        },
        {
          name: 'PATCH /api/locations/[locationId]',
          invoke: async () =>
            callRoute(
              location.PATCH,
              await requestWithOwner(`/api/locations/${OTHER_LOCATION_ID}`, {
                method: 'PATCH',
                body: { name: 'Mutated Other Kitchen' },
              }),
              { locationId: OTHER_LOCATION_ID },
            ),
        },
        {
          name: 'DELETE /api/locations/[locationId]',
          invoke: async () =>
            callRoute(
              location.DELETE,
              await requestWithOwner(`/api/locations/${OTHER_LOCATION_ID}`, {
                method: 'DELETE',
              }),
              { locationId: OTHER_LOCATION_ID },
            ),
        },
        {
          name: 'POST /api/manual-entry',
          invoke: async () =>
            callRoute(
              manualEntry.POST,
              await requestWithOwner('/api/manual-entry', {
                method: 'POST',
                query: { locationId: OTHER_LOCATION_ID },
                body: {},
              }),
            ),
        },
        {
          name: 'GET /api/observability',
          invoke: async () =>
            callRoute(
              observability.GET,
              await requestWithOwner('/api/observability', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'GET /api/recipes',
          invoke: async () =>
            callRoute(
              recipes.GET,
              await requestWithOwner('/api/recipes', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'POST /api/recipes',
          invoke: async () =>
            callRoute(
              recipes.POST,
              await requestWithOwner('/api/recipes', {
                method: 'POST',
                body: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'GET /api/reconciliation',
          invoke: async () =>
            callRoute(
              reconciliation.GET,
              await requestWithOwner('/api/reconciliation', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'POST /api/reconciliation',
          invoke: async () =>
            callRoute(
              reconciliation.POST,
              await requestWithOwner('/api/reconciliation', {
                method: 'POST',
                body: {
                  locationId: OTHER_LOCATION_ID,
                  conflictId: '00000000-0000-4000-8000-00000000f102',
                  authoritySource: 'csv',
                },
              }),
            ),
        },
        {
          name: 'POST /api/uploads/[uploadId]/commit',
          invoke: async () =>
            callRoute(
              uploadCommit.POST,
              await requestWithOwner(`/api/uploads/${OTHER_UPLOAD_ID}/commit`, {
                method: 'POST',
                body: { dryRun: true },
              }),
              { uploadId: OTHER_UPLOAD_ID },
            ),
        },
        {
          name: 'PATCH /api/uploads/[uploadId]/mapping',
          invoke: async () =>
            callRoute(
              uploadMapping.PATCH,
              await requestWithOwner(
                `/api/uploads/${OTHER_UPLOAD_ID}/mapping`,
                {
                  method: 'PATCH',
                  body: { mapping: { Item: 'rawItemName' } },
                },
              ),
              { uploadId: OTHER_UPLOAD_ID },
            ),
        },
        {
          name: 'GET /api/uploads/[uploadId]/preview',
          invoke: async () =>
            callRoute(
              uploadPreview.GET,
              await requestWithOwner(`/api/uploads/${OTHER_UPLOAD_ID}/preview`),
              { uploadId: OTHER_UPLOAD_ID },
            ),
        },
        {
          name: 'GET /api/uploads/history',
          invoke: async () =>
            callRoute(
              uploadHistory.GET,
              await requestWithOwner('/api/uploads/history', {
                query: { locationId: OTHER_LOCATION_ID },
              }),
            ),
        },
        {
          name: 'POST /api/uploads',
          invoke: async () => {
            const headers = await ownerHeaders()
            headers.set('x-pantryiq-filename', 'other.csv')
            headers.set('x-pantryiq-import-type', 'transactions')
            headers.set('content-type', 'text/csv')
            setRequestHeaders(headers)
            return callRoute(
              uploads.POST,
              buildRequest('/api/uploads', {
                method: 'POST',
                query: { locationId: OTHER_LOCATION_ID },
                headers,
                rawBody: 'Date,Item\n2026-01-01,Other Item\n',
              }),
            )
          },
        },
      ]
    }, SETUP_TIMEOUT_MS)

    afterAll(async () => {
      await closeAppDatabaseClient()
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousDatabaseUrl
      await opened?.close()
    })

    it('refuses account B data for account A across every location-scoped route', async () => {
      for (const { name, invoke } of cases) {
        const result = await invoke()
        expect([403, 404], name).toContain(result.status)
      }
    })

    it('keeps the account-scoped location collection free of account B data', async () => {
      const locations = await import('../../app/api/locations/route')
      const result = await callRoute(
        locations.GET,
        await requestWithOwner('/api/locations', {
          query: { locationId: OTHER_LOCATION_ID },
        }),
      )

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        locations: [
          expect.objectContaining({
            id: OWNER_LOCATION_ID,
            userId: OWNER_ID,
          }),
        ],
      })
      expect(JSON.stringify(result.body)).not.toContain(OTHER_LOCATION_ID)
    })
  },
)
