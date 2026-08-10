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
 * Replaces the string assertions in tests/location-management-contract.test.ts,
 * which looped over eight table names and checked the source contained
 * `.delete(<table>)`. That passes even if a delete is scoped to the wrong
 * column, or if a ninth table is added and never cleaned up.
 *
 * These tests delete a location that has rows in every child table and then
 * count what survives.
 */

type StubSession = { user: { id: string } } | null
const sessionState: { current: StubSession } = { current: null }

vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: async () => sessionState.current } },
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const KEPT_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d003'
const SETUP_TIMEOUT_MS = 120_000

/** Every table `deleteLocation` is responsible for clearing. */
const CHILD_TABLES = [
  'inventory_snapshots',
  'transactions',
  'purchase_order_items',
  'purchase_orders',
  'csv_upload_history',
  'recipes',
  'inventory_items',
] as const

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let locationService: typeof import('../../src/server/locations/locations')

describe.skipIf(!integrationDatabaseEnabled())('location deletion', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    locationService = await import('../../src/server/locations/locations')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    // Close the app pool before the env is restored and before the container
    // stops, or its idle connections raise after the suite has passed.
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  /** Fills every child table for the three locations under test. */
  async function seedLocations() {
    const { sql } = opened!.database

    for (const table of CHILD_TABLES) await sql`delete from ${sql(table)}`
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
        (${LOCATION_ID}, ${OWNER_ID}, 'Doomed'),
        (${KEPT_LOCATION_ID}, ${OWNER_ID}, 'Kept'),
        (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'Other account')
    `

    for (const locationId of [
      LOCATION_ID,
      KEPT_LOCATION_ID,
      OTHER_LOCATION_ID,
    ]) {
      const [item] = await sql<{ id: string }[]>`
        insert into inventory_items (location_id, canonical_name, display_name, unit)
        values (${locationId}, 'salmon', 'Salmon', 'lb')
        returning id
      `
      const itemId = item!.id

      await sql`
        insert into inventory_snapshots
          (location_id, inventory_item_id, counted_at, qty, source)
        values (${locationId}, ${itemId}, now(), 4, 'csv')
      `
      await sql`
        insert into transactions
          (location_id, transacted_at, external_id, source, menu_item_id,
           raw_item_name, qty, unit_price, total_revenue)
        values
          (${locationId}, now(), ${'sale-' + locationId}, 'csv', ${itemId},
           'Salmon', 2, 24.00, 48.00)
      `
      const [order] = await sql<{ id: string }[]>`
        insert into purchase_orders (location_id, ordered_at, external_id, source)
        values (${locationId}, now(), ${'po-' + locationId}, 'csv')
        returning id
      `
      await sql`
        insert into purchase_order_items
          (purchase_order_id, location_id, inventory_item_id, raw_item_name,
           qty, unit_cost, total_cost)
        values (${order!.id}, ${locationId}, ${itemId}, 'Salmon', 3, 8.00, 24.00)
      `
      await sql`
        insert into csv_upload_history
          (location_id, filename, source, status, rows_imported, mapping_used,
           uploaded_at)
        values
          (${locationId}, 'sales.csv', 'csv', 'imported', 1, '{}'::jsonb, now())
      `
      await sql`
        insert into recipes
          (location_id, menu_item_id, name, output_quantity, output_unit)
        values (${locationId}, ${itemId}, 'Chowder', 1, 'batch')
      `
    }
  }

  async function countFor(table: string, locationId: string) {
    const { sql } = opened!.database
    const [row] = await sql<{ count: string }[]>`
      select count(*)::text as count from ${sql(table)} where location_id = ${locationId}
    `
    return Number(row?.count ?? 0)
  }

  beforeEach(async () => {
    await seedLocations()
    sessionState.current = { user: { id: OWNER_ID } }
  })

  it('starts from a location that has a row in every child table', async () => {
    for (const table of CHILD_TABLES) {
      expect(await countFor(table, LOCATION_ID), table).toBe(1)
    }
  })

  it('clears every child table for the deleted location', async () => {
    await locationService.deleteLocation(new Headers(), LOCATION_ID)

    for (const table of CHILD_TABLES) {
      expect(await countFor(table, LOCATION_ID), table).toBe(0)
    }

    const { sql } = opened!.database
    const remaining =
      await sql`select id from locations where id = ${LOCATION_ID}`
    expect(remaining).toHaveLength(0)
  })

  it('leaves the account other locations untouched', async () => {
    await locationService.deleteLocation(new Headers(), LOCATION_ID)

    for (const table of CHILD_TABLES) {
      expect(await countFor(table, KEPT_LOCATION_ID), table).toBe(1)
    }
  })

  it('leaves another account data untouched', async () => {
    await locationService.deleteLocation(new Headers(), LOCATION_ID)

    for (const table of CHILD_TABLES) {
      expect(await countFor(table, OTHER_LOCATION_ID), table).toBe(1)
    }
  })

  it('refuses to delete a location belonging to another account', async () => {
    await expect(
      locationService.deleteLocation(new Headers(), OTHER_LOCATION_ID),
    ).rejects.toThrow()

    for (const table of CHILD_TABLES) {
      expect(await countFor(table, OTHER_LOCATION_ID), table).toBe(1)
    }
  })

  it('refuses an unauthenticated delete and changes nothing', async () => {
    sessionState.current = null

    await expect(
      locationService.deleteLocation(new Headers(), LOCATION_ID),
    ).rejects.toThrow()

    for (const table of CHILD_TABLES) {
      expect(await countFor(table, LOCATION_ID), table).toBe(1)
    }
  })

  it('summarises what a delete would remove, scoped to the owner', async () => {
    const summary = await locationService.getLocationDeletionSummary(
      new Headers(),
      LOCATION_ID,
    )

    expect(summary).toMatchObject({
      locationName: 'Doomed',
      importCount: 1,
      importedRowCount: 1,
    })
  })

  it('will not summarise another account location', async () => {
    await expect(
      locationService.getLocationDeletionSummary(
        new Headers(),
        OTHER_LOCATION_ID,
      ),
    ).rejects.toThrow()
  })
})
