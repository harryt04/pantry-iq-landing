import { describe, expect, it } from 'vitest'
import postgres from 'postgres'

import {
  rollbackDatabase,
  migrateDatabase,
} from '../../src/server/db/migrations'
import { seedDatabase } from '../../src/server/db/seed-database'
import { withTestDatabase } from '../helpers/test-database'

const testcontainersEnabled = process.env.TESTCONTAINERS_ENABLED === '1'

const canonicalTables = [
  'locations',
  'inventory_items',
  'transactions',
  'purchase_orders',
  'purchase_order_items',
  'inventory_snapshots',
  'csv_upload_history',
  '__drizzle_migrations',
] as const

const canonicalIndexes = [
  'inventory_items_location_canonical_name_idx',
  'inventory_snapshots_location_counted_at_idx',
  'purchase_order_items_location_inventory_item_idx',
  'purchase_orders_location_source_external_id_idx',
  'transactions_location_transacted_at_idx',
  'transactions_location_menu_item_idx',
  'transactions_location_source_external_id_idx',
] as const

async function expectCanonicalSchema(sql: ReturnType<typeof postgres>) {
  const tables = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${sql.array([...canonicalTables])})
    order by table_name
  `
  expect(tables.map(({ table_name }) => table_name)).toEqual(
    [...canonicalTables].sort(),
  )

  const indexes = await sql<{ indexname: string }[]>`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname = any(${sql.array([...canonicalIndexes])})
    order by indexname
  `
  expect(indexes.map(({ indexname }) => indexname)).toEqual(
    [...canonicalIndexes].sort(),
  )
}

describe.skipIf(!testcontainersEnabled)('schema migration round trip', () => {
  it('migrates, seeds, rolls back, and migrates again', async () => {
    await withTestDatabase(async (sql) => {
      await migrateDatabase(sql)
      await expectCanonicalSchema(sql)

      await seedDatabase(sql)
      const seededRows = await sql<{ count: string }[]>`
        select count(*)::text as count from transactions
      `
      expect(seededRows[0]?.count).toBe('35')

      await rollbackDatabase(sql)

      const rolledBackTables = await sql<{ table_name: string | null }[]>`
        select to_regclass(table_name)::text as table_name
        from (values
          ('public.locations'),
          ('public.inventory_items'),
          ('public.transactions'),
          ('public.purchase_orders'),
          ('public.purchase_order_items'),
          ('public.inventory_snapshots'),
          ('public.csv_upload_history'),
          ('public.__drizzle_migrations')
        ) as tables(table_name)
      `
      expect(
        rolledBackTables.every(({ table_name }) => table_name === null),
      ).toBe(true)

      await migrateDatabase(sql)
      await expectCanonicalSchema(sql)
    })
  })
})
