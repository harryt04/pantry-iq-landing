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

type StubSession = { user: { id: string } } | null
const sessionState: { current: StubSession } = { current: null }
const enqueuePrecomputeForLocationInTransaction = vi.fn()

vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: async () => sessionState.current } },
}))

vi.mock('@/src/server/metrics/scheduler', () => ({
  enqueuePrecomputeForLocationInTransaction: (...args: unknown[]) =>
    enqueuePrecomputeForLocationInTransaction(...args),
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const INACTIVE_LOCATION_ID = '00000000-0000-4000-8000-00000000d003'
const ITEM_ID = '00000000-0000-4000-8000-00000000e001'
const OTHER_ITEM_ID = '00000000-0000-4000-8000-00000000e002'
const INACTIVE_ITEM_ID = '00000000-0000-4000-8000-00000000e003'
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let items: typeof import('../../src/server/inventory/items')
let locations: typeof import('../../src/server/locations/locations')

describe.skipIf(!integrationDatabaseEnabled())(
  'inventory and location service persistence',
  () => {
    beforeAll(async () => {
      opened = await openTestDatabase()
      const { sql, url } = opened.database

      await rollbackDatabase(sql)
      await migrateDatabase(sql)

      previousDatabaseUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = url
      items = await import('../../src/server/inventory/items')
      locations = await import('../../src/server/locations/locations')
    }, SETUP_TIMEOUT_MS)

    afterAll(async () => {
      await closeAppDatabaseClient()
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousDatabaseUrl
      await opened?.close()
    })

    beforeEach(async () => {
      const { sql } = opened!.database
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
        insert into locations (id, user_id, name, is_active)
        values
          (${LOCATION_ID}, ${OWNER_ID}, 'North', true),
          (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'South', true),
          (${INACTIVE_LOCATION_ID}, ${OWNER_ID}, 'Closed', false)
      `

      await sql`
        insert into inventory_items
          (id, location_id, canonical_name, display_name, category, unit,
           cost_per_unit, usage_count)
        values
          (${ITEM_ID}, ${LOCATION_ID}, 'zucchini', 'Zucchini', 'Produce', 'lb',
           1.2300, 2),
          (${INACTIVE_ITEM_ID}, ${LOCATION_ID}, 'old zucchini', 'Old Zucchini',
           'Produce', 'lb', 1.2300, 0),
          (${OTHER_ITEM_ID}, ${OTHER_LOCATION_ID}, 'zucchini', 'Zucchini',
           'Produce', 'lb', 99.9900, 7)
      `
      await sql`
        update inventory_items set is_active = false where id = ${INACTIVE_ITEM_ID}
      `
      sessionState.current = { user: { id: OWNER_ID } }
      enqueuePrecomputeForLocationInTransaction.mockReset()
    })

    it('creates and lists owner-scoped items without losing exact numeric values', async () => {
      const created = await items.createInventoryItem(
        new Headers(),
        LOCATION_ID,
        {
          canonicalName: ' tomato soup ',
          displayName: ' Tomato Soup ',
          category: ' prepared food ',
          unit: ' each ',
          costPerUnit: '8.5000',
          parLevel: '12.00',
        },
      )

      expect(created).toMatchObject({
        locationId: LOCATION_ID,
        canonicalName: 'tomato soup',
        displayName: 'Tomato Soup',
        category: 'prepared food',
        unit: 'each',
        costPerUnit: '8.5000',
        parLevel: '12.00',
      })

      const active = await items.listInventoryItems(new Headers(), LOCATION_ID)
      expect(active.map((item) => item.canonicalName)).toEqual([
        'tomato soup',
        'zucchini',
      ])
      expect(active.every((item) => item.locationId === LOCATION_ID)).toBe(true)

      const all = await items.listInventoryItems(new Headers(), LOCATION_ID, {
        includeInactive: true,
      })
      expect(all).toHaveLength(3)
    })

    it('gets and updates only an owned item, then schedules recalculation', async () => {
      await expect(
        items.getInventoryItem(new Headers(), LOCATION_ID, 'not-a-uuid'),
      ).rejects.toThrow('itemId must be a UUID.')

      await expect(
        items.getInventoryItem(new Headers(), OTHER_LOCATION_ID, OTHER_ITEM_ID),
      ).rejects.toThrow()

      await expect(
        items.getInventoryItem(
          new Headers(),
          LOCATION_ID,
          '00000000-0000-4000-8000-00000000e099',
        ),
      ).rejects.toBeInstanceOf(items.InventoryItemNotFoundError)

      const updated = await items.updateInventoryItem(
        new Headers(),
        LOCATION_ID,
        ITEM_ID,
        { displayName: 'Courgette', costPerUnit: '1.230000' },
      )

      expect(updated).toMatchObject({
        id: ITEM_ID,
        displayName: 'Courgette',
        costPerUnit: '1.230000',
      })
      expect(enqueuePrecomputeForLocationInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        LOCATION_ID,
      )

      const fetched = await items.getInventoryItem(
        new Headers(),
        LOCATION_ID,
        ITEM_ID,
      )
      expect(fetched.displayName).toBe('Courgette')
      expect(fetched.costPerUnit).toBe('1.230000')
    })

    it('increments usage with a positive integer and rejects unsafe counts', async () => {
      const updated = await items.incrementInventoryItemUsage(
        new Headers(),
        LOCATION_ID,
        ITEM_ID,
        3,
      )
      expect(updated.usageCount).toBe(5)

      await expect(
        items.incrementInventoryItemUsage(
          new Headers(),
          LOCATION_ID,
          ITEM_ID,
          0,
        ),
      ).rejects.toThrow('usage increment must be a positive integer.')
      await expect(
        items.incrementInventoryItemUsage(
          new Headers(),
          LOCATION_ID,
          ITEM_ID,
          Number.MAX_SAFE_INTEGER + 1,
        ),
      ).rejects.toThrow('usage increment must be a positive integer.')
    })

    it('lists, creates, and updates locations within the signed-in account', async () => {
      const listed = await locations.listLocations(new Headers())
      expect(listed.map((location) => location.id)).toEqual([
        LOCATION_ID,
        INACTIVE_LOCATION_ID,
      ])

      const created = await locations.createLocation(new Headers(), {
        name: '  Downtown  ',
        address: '  1 Main Street  ',
      })
      expect(created).toMatchObject({
        userId: OWNER_ID,
        name: 'Downtown',
        address: '1 Main Street',
      })

      const updated = await locations.updateLocation(
        new Headers(),
        LOCATION_ID,
        { name: 'North Kitchen', isActive: false },
      )
      expect(updated).toMatchObject({
        id: LOCATION_ID,
        name: 'North Kitchen',
        isActive: false,
      })

      await expect(
        locations.updateLocation(new Headers(), OTHER_LOCATION_ID, {
          name: 'Stolen',
        }),
      ).rejects.toThrow()
    })
  },
)
