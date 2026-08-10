import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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
import type {
  ConnectorAdapter,
  ConnectorTokens,
} from '../../src/server/connectors/types'

/**
 * `src/server/connectors/framework.ts` was the largest untested server module
 * after the CSV importer in the 2026-08-10 audit. It holds an OAuth handshake,
 * so the properties under test are security properties: a state token is
 * single-use and short-lived, a return path cannot become an open redirect,
 * credentials never land in plain text, and one account cannot touch another
 * account's connection.
 */

type StubSession = { user: { id: string } } | null
const sessionState: { current: StubSession } = { current: null }

vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: async () => sessionState.current } },
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const REDIRECT_URI = 'https://app.example.com/api/connectors/square/callback'
const NOW = new Date('2026-08-10T12:00:00.000Z')
const SETUP_TIMEOUT_MS = 120_000

const tokens: ConnectorTokens = {
  accessToken: 'super-secret-access-token',
  refreshToken: 'super-secret-refresh-token',
  accessTokenExpiresAt: new Date('2026-09-10T12:00:00.000Z'),
}

function stubAdapter(provider = 'square'): ConnectorAdapter {
  return {
    provider,
    authorizationUrl: ({ state, redirectUri }) =>
      `https://connect.example.com/oauth?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    exchangeCode: async () => ({
      providerAccountId: 'merchant-1',
      tokens,
    }),
    refreshTokens: async (current) => current,
    backfill: async () => ({ records: [], nextCursor: null, complete: true }),
    incremental: async () => ({
      records: [],
      nextCursor: null,
      complete: true,
    }),
    verifyWebhook: async () => ({
      eventId: 'event-1',
      occurredAt: NOW,
    }),
  }
}

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let previousCredentialKey: string | undefined
let framework: typeof import('../../src/server/connectors/framework')

describe.skipIf(!integrationDatabaseEnabled())('connector framework', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    previousCredentialKey = process.env.CONNECTOR_CREDENTIAL_KEY
    process.env.DATABASE_URL = url
    process.env.CONNECTOR_CREDENTIAL_KEY =
      'test-connector-credential-key-0123456789'
    framework = await import('../../src/server/connectors/framework')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    if (previousCredentialKey === undefined)
      delete process.env.CONNECTOR_CREDENTIAL_KEY
    else process.env.CONNECTOR_CREDENTIAL_KEY = previousCredentialKey
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from connector_oauth_states`
    await sql`delete from connector_connections`
    await sql`delete from locations`
    await sql`delete from "user"`

    await sql`
      insert into "user" (id, name, email)
      values
        (${OWNER_ID}, 'Owner', 'owner@example.com'),
        (${OTHER_OWNER_ID}, 'Other', 'other@example.com')
    `
    await sql`
      insert into locations (id, user_id, name)
      values
        (${LOCATION_ID}, ${OWNER_ID}, 'North'),
        (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'South')
    `

    sessionState.current = { user: { id: OWNER_ID } }
  })

  async function begin(returnTo?: string) {
    return framework.beginConnectorAuthorization({
      headers: new Headers(),
      locationId: LOCATION_ID,
      adapter: stubAdapter(),
      redirectUri: REDIRECT_URI,
      now: NOW,
      ...(returnTo === undefined ? {} : { returnTo }),
    })
  }

  describe('starting an authorization', () => {
    it('returns a provider URL carrying the issued state', async () => {
      const { url, state } = await begin()

      expect(state).toHaveLength(43)
      expect(url).toContain(`state=${state}`)
    })

    it('stores the state hashed, never in the clear', async () => {
      const { state } = await begin()

      const { sql } = opened!.database
      const [row] = await sql<{ state_hash: string }[]>`
        select state_hash from connector_oauth_states
      `
      // A leaked database row must not be replayable as a callback.
      expect(row?.state_hash).not.toBe(state)
      expect(row?.state_hash).not.toContain(state)
    })

    it('refuses to start on a location the caller does not own', async () => {
      await expect(
        framework.beginConnectorAuthorization({
          headers: new Headers(),
          locationId: OTHER_LOCATION_ID,
          adapter: stubAdapter(),
          redirectUri: REDIRECT_URI,
          now: NOW,
        }),
      ).rejects.toThrow()
    })

    it.each([
      ['a scheme-relative path', '//evil.example.com'],
      ['an absolute URL', 'https://evil.example.com'],
      ['a bare path with no leading slash', 'dashboard'],
    ])('refuses %s as a return path', async (_label, returnTo) => {
      // Any of these would turn the callback into an open redirect.
      await expect(begin(returnTo)).rejects.toBeInstanceOf(
        framework.ConnectorStateError,
      )
    })

    it('accepts an in-app return path', async () => {
      await expect(begin('/settings?tab=connectors')).resolves.toBeTruthy()
    })
  })

  describe('completing an authorization', () => {
    it('creates a connected connection and returns its location', async () => {
      const { state } = await begin('/settings')

      const result = await framework.completeConnectorAuthorization({
        adapter: stubAdapter(),
        code: 'auth-code',
        state,
        now: NOW,
      })

      expect(result).toMatchObject({
        locationId: LOCATION_ID,
        returnTo: '/settings',
      })

      const { sql } = opened!.database
      const [connection] = await sql<{ status: string }[]>`
        select status from connector_connections where id = ${result.connectionId}
      `
      expect(connection?.status).toBe('connected')
    })

    it('never stores the access token in plain text', async () => {
      const { state } = await begin()
      await framework.completeConnectorAuthorization({
        adapter: stubAdapter(),
        code: 'auth-code',
        state,
        now: NOW,
      })

      const { sql } = opened!.database
      const [row] = await sql<{ encrypted_credentials: string }[]>`
        select encrypted_credentials::text from connector_connections
      `
      expect(row?.encrypted_credentials).not.toContain(tokens.accessToken)
      expect(row?.encrypted_credentials).not.toContain(tokens.refreshToken)
    })

    it('refuses a second use of the same state', async () => {
      const { state } = await begin()
      await framework.completeConnectorAuthorization({
        adapter: stubAdapter(),
        code: 'auth-code',
        state,
        now: NOW,
      })

      // A replayed callback must not mint a second connection.
      await expect(
        framework.completeConnectorAuthorization({
          adapter: stubAdapter(),
          code: 'auth-code',
          state,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(framework.ConnectorStateError)
    })

    it('refuses an expired state', async () => {
      const { state } = await begin()
      const later = new Date(NOW.getTime() + 11 * 60 * 1000)

      await expect(
        framework.completeConnectorAuthorization({
          adapter: stubAdapter(),
          code: 'auth-code',
          state,
          now: later,
        }),
      ).rejects.toBeInstanceOf(framework.ConnectorStateError)
    })

    it('refuses a state issued for a different provider', async () => {
      const { state } = await begin()

      await expect(
        framework.completeConnectorAuthorization({
          adapter: stubAdapter('toast'),
          code: 'auth-code',
          state,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(framework.ConnectorStateError)
    })

    it('refuses a state that was never issued', async () => {
      await expect(
        framework.completeConnectorAuthorization({
          adapter: stubAdapter(),
          code: 'auth-code',
          state: 'never-issued-state-value',
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(framework.ConnectorStateError)
    })

    it('reconnecting the same provider replaces the connection, not adds one', async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { state } = await begin()
        await framework.completeConnectorAuthorization({
          adapter: stubAdapter(),
          code: 'auth-code',
          state,
          now: NOW,
        })
      }

      const { sql } = opened!.database
      const rows = await sql`select id from connector_connections`
      expect(rows).toHaveLength(1)
    })
  })

  describe('listing and disconnecting', () => {
    async function connect() {
      const { state } = await begin()
      return framework.completeConnectorAuthorization({
        adapter: stubAdapter(),
        code: 'auth-code',
        state,
        now: NOW,
      })
    }

    it('lists only the caller own connections', async () => {
      await connect()

      const mine = await framework.listConnectorConnectionStatuses({
        headers: new Headers(),
      })
      expect(mine).toHaveLength(1)

      sessionState.current = { user: { id: OTHER_OWNER_ID } }
      const theirs = await framework.listConnectorConnectionStatuses({
        headers: new Headers(),
      })
      expect(theirs).toHaveLength(0)
    })

    it('refuses to disconnect another account connection', async () => {
      const { connectionId } = await connect()
      sessionState.current = { user: { id: OTHER_OWNER_ID } }

      await expect(
        framework.disconnectConnectorConnection({
          headers: new Headers(),
          connectionId,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(framework.ConnectorStateError)

      const { sql } = opened!.database
      const [row] = await sql<{ status: string }[]>`
        select status from connector_connections where id = ${connectionId}
      `
      expect(row?.status).toBe('connected')
    })

    it('removes the usable credential when the owner disconnects', async () => {
      const { connectionId } = await connect()

      await framework.disconnectConnectorConnection({
        headers: new Headers(),
        connectionId,
        now: NOW,
      })

      const { sql } = opened!.database
      const [row] = await sql<
        { status: string; encrypted_credentials: string }[]
      >`
        select status, encrypted_credentials::text
        from connector_connections
        where id = ${connectionId}
      `
      expect(row?.status).not.toBe('connected')
      // The row survives for audit, but a later sync must not be able to resume.
      expect(row?.encrypted_credentials).not.toContain(tokens.accessToken)
    })
  })
})
