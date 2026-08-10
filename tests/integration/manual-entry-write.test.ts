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

/**
 * Replaces the string assertions in tests/manual-entry-contract.test.ts, which
 * checked the source contained `db.transaction` and `source: 'manual'`.
 *
 * A manual entry writes to several tables and creates inventory items on the
 * fly. The property worth testing is that a partial write never survives, and
 * that entries land under the caller's own location.
 */

type StubSession = { user: { id: string } } | null
const sessionState: { current: StubSession } = { current: null }

vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: async () => sessionState.current } },
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d003'
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let manual: typeof import('../../src/server/manual/manual-entry')

async function countRows(table: string, locationId: string) {
  const { sql } = opened!.database
  const [row] = await sql<{ count: string }[]>`
    select count(*)::text as count from ${sql(table)} where location_id = ${locationId}
  `
  return Number(row?.count ?? 0)
}

describe.skipIf(!integrationDatabaseEnabled())('manual entry writes', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    manual = await import('../../src/server/manual/manual-entry')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    // Close the app pool before the env is restored and before the container
    // stops, or its idle connections raise after the suite has passed.
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from inventory_snapshots`
    await sql`delete from transactions`
    await sql`delete from csv_upload_history`
    await sql`delete from inventory_items`
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

  const inventoryEntry = {
    entryType: 'inventory',
    countedAt: '2026-08-01T12:00:00.000Z',
    quantity: '12',
    item: {
      newItem: {
        canonicalName: 'salmon',
        displayName: 'Salmon',
        category: 'seafood',
        unit: 'lb',
      },
    },
  }

  it('writes the count and creates the item it referenced', async () => {
    await manual.createManualEntry(new Headers(), LOCATION_ID, inventoryEntry)

    expect(await countRows('inventory_snapshots', LOCATION_ID)).toBe(1)
    expect(await countRows('inventory_items', LOCATION_ID)).toBe(1)

    const { sql } = opened!.database
    const [snapshot] = await sql<{ source: string; qty: string }[]>`
      select source, qty from inventory_snapshots where location_id = ${LOCATION_ID}
    `
    expect(snapshot?.source).toBe('manual')
    expect(Number(snapshot?.qty)).toBe(12)
  })

  it('creates no item when the entry itself is invalid', async () => {
    // The item would be created inside the same transaction as the snapshot,
    // so a later validation failure must take the item with it.
    await expect(
      manual.createManualEntry(new Headers(), LOCATION_ID, {
        ...inventoryEntry,
        quantity: 'not a number',
      }),
    ).rejects.toBeInstanceOf(manual.ManualEntryValidationError)

    expect(await countRows('inventory_items', LOCATION_ID)).toBe(0)
    expect(await countRows('inventory_snapshots', LOCATION_ID)).toBe(0)
  })

  it('reuses an existing item rather than duplicating it', async () => {
    await manual.createManualEntry(new Headers(), LOCATION_ID, inventoryEntry)
    await manual.createManualEntry(new Headers(), LOCATION_ID, {
      ...inventoryEntry,
      countedAt: '2026-08-02T12:00:00.000Z',
    })

    expect(await countRows('inventory_items', LOCATION_ID)).toBe(1)
    expect(await countRows('inventory_snapshots', LOCATION_ID)).toBe(2)
  })

  it('writes a transaction entry under the manual source', async () => {
    await manual.createManualEntry(new Headers(), LOCATION_ID, {
      entryType: 'transaction',
      transactedAt: '2026-08-01T18:00:00.000Z',
      quantity: '2',
      unitPrice: '24.00',
      totalRevenue: '48.00',
      totalCost: '19.00',
      item: {
        newItem: {
          canonicalName: 'salmon',
          displayName: 'Salmon',
          category: 'seafood',
          unit: 'lb',
        },
      },
    })

    const { sql } = opened!.database
    const [row] = await sql<{ source: string; external_id: string }[]>`
      select source, external_id from transactions where location_id = ${LOCATION_ID}
    `
    expect(row?.source).toBe('manual')
    // A manual row still needs a stable external id so a later re-import
    // cannot silently collide with it.
    expect(row?.external_id).toMatch(/^manual-/)
  })

  it('refuses to write into another account location', async () => {
    await expect(
      manual.createManualEntry(
        new Headers(),
        OTHER_LOCATION_ID,
        inventoryEntry,
      ),
    ).rejects.toThrow()

    expect(await countRows('inventory_snapshots', OTHER_LOCATION_ID)).toBe(0)
    expect(await countRows('inventory_items', OTHER_LOCATION_ID)).toBe(0)
  })

  it('refuses an unauthenticated write', async () => {
    sessionState.current = null

    await expect(
      manual.createManualEntry(new Headers(), LOCATION_ID, inventoryEntry),
    ).rejects.toThrow()

    expect(await countRows('inventory_snapshots', LOCATION_ID)).toBe(0)
  })

  it('rejects an unknown entry type before it opens a transaction', async () => {
    await expect(
      manual.createManualEntry(new Headers(), LOCATION_ID, {
        entryType: 'teleport',
      }),
    ).rejects.toBeInstanceOf(manual.ManualEntryValidationError)

    expect(await countRows('inventory_snapshots', LOCATION_ID)).toBe(0)
  })
})
