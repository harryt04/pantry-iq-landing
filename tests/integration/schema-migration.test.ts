import { describe, expect, it } from 'vitest'
import postgres from 'postgres'

import {
  rollbackDatabase,
  migrateDatabase,
} from '../../src/server/db/migrations'
import { seedDatabase } from '../../src/server/db/seed-database'
import {
  integrationDatabaseEnabled,
  withTestDatabase,
} from '../helpers/test-database'

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

const canonicalColumns = [
  ['locations', 'id', false, 'uuid'],
  ['locations', 'user_id', false, 'uuid'],
  ['locations', 'name', false, 'text'],
  ['locations', 'address', true, 'text'],
  ['locations', 'timezone', false, 'text'],
  ['locations', 'business_day_boundary', false, 'time without time zone'],
  ['locations', 'created_at', false, 'timestamp with time zone'],
  ['locations', 'updated_at', false, 'timestamp with time zone'],
  ['inventory_items', 'id', false, 'uuid'],
  ['inventory_items', 'location_id', false, 'uuid'],
  ['inventory_items', 'canonical_name', false, 'text'],
  ['inventory_items', 'display_name', false, 'text'],
  ['inventory_items', 'category', true, 'text'],
  ['inventory_items', 'unit', false, 'text'],
  ['inventory_items', 'shelf_life_days', true, 'integer'],
  ['inventory_items', 'cost_per_unit', true, 'numeric'],
  ['inventory_items', 'par_level', true, 'numeric'],
  ['inventory_items', 'is_active', false, 'boolean'],
  ['inventory_items', 'usage_count', false, 'integer'],
  ['inventory_items', 'created_at', false, 'timestamp with time zone'],
  ['inventory_items', 'updated_at', false, 'timestamp with time zone'],
  ['transactions', 'id', false, 'uuid'],
  ['transactions', 'location_id', false, 'uuid'],
  ['transactions', 'transacted_at', false, 'timestamp with time zone'],
  ['transactions', 'external_id', false, 'text'],
  ['transactions', 'source', false, 'text'],
  ['transactions', 'menu_item_id', true, 'uuid'],
  ['transactions', 'raw_item_name', false, 'text'],
  ['transactions', 'category', true, 'text'],
  ['transactions', 'qty', false, 'numeric'],
  ['transactions', 'unit_price', false, 'numeric'],
  ['transactions', 'total_revenue', false, 'numeric'],
  ['transactions', 'total_cost', true, 'numeric'],
  ['transactions', 'gross_margin', true, 'numeric'],
  ['transactions', 'created_at', false, 'timestamp with time zone'],
  ['purchase_orders', 'id', false, 'uuid'],
  ['purchase_orders', 'location_id', false, 'uuid'],
  ['purchase_orders', 'ordered_at', false, 'timestamp with time zone'],
  ['purchase_orders', 'received_at', true, 'timestamp with time zone'],
  ['purchase_orders', 'external_id', true, 'text'],
  ['purchase_orders', 'source', false, 'text'],
  ['purchase_orders', 'supplier_name', true, 'text'],
  ['purchase_orders', 'created_at', false, 'timestamp with time zone'],
  ['purchase_order_items', 'id', false, 'uuid'],
  ['purchase_order_items', 'purchase_order_id', false, 'uuid'],
  ['purchase_order_items', 'location_id', false, 'uuid'],
  ['purchase_order_items', 'inventory_item_id', true, 'uuid'],
  ['purchase_order_items', 'raw_item_name', false, 'text'],
  ['purchase_order_items', 'qty', false, 'numeric'],
  ['purchase_order_items', 'unit_cost', false, 'numeric'],
  ['purchase_order_items', 'total_cost', false, 'numeric'],
  ['purchase_order_items', 'created_at', false, 'timestamp with time zone'],
  ['inventory_snapshots', 'id', false, 'uuid'],
  ['inventory_snapshots', 'location_id', false, 'uuid'],
  ['inventory_snapshots', 'inventory_item_id', false, 'uuid'],
  ['inventory_snapshots', 'counted_at', false, 'timestamp with time zone'],
  ['inventory_snapshots', 'qty', false, 'numeric'],
  ['inventory_snapshots', 'source', false, 'text'],
  ['inventory_snapshots', 'created_at', false, 'timestamp with time zone'],
  ['csv_upload_history', 'id', false, 'uuid'],
  ['csv_upload_history', 'location_id', false, 'uuid'],
  ['csv_upload_history', 'filename', false, 'text'],
  ['csv_upload_history', 'source', false, 'text'],
  ['csv_upload_history', 'rows_imported', false, 'integer'],
  ['csv_upload_history', 'mapping_used', false, 'jsonb'],
  ['csv_upload_history', 'unmatched_items', true, 'jsonb'],
  ['csv_upload_history', 'uploaded_at', false, 'timestamp with time zone'],
  ['csv_upload_history', 'created_at', false, 'timestamp with time zone'],
] as const

async function expectCanonicalSchema(sql: ReturnType<typeof postgres>) {
  const tables = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `
  expect(tables.map(({ table_name }) => table_name)).toEqual(
    [...canonicalTables].sort(),
  )

  const columns = await sql<
    {
      table_name: string
      column_name: string
      is_nullable: 'YES' | 'NO'
      data_type: string
    }[]
  >`
    select table_name, column_name, is_nullable, data_type
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `
  expect(
    columns.map(({ table_name, column_name, is_nullable, data_type }) => [
      table_name,
      column_name,
      is_nullable === 'YES',
      data_type,
    ]),
  ).toEqual(
    [...canonicalColumns]
      .map(([tableName, columnName, nullable, dataType]) => [
        tableName,
        columnName,
        nullable,
        dataType,
      ])
      .sort(([tableA, columnA], [tableB, columnB]) =>
        `${tableA}.${columnA}`.localeCompare(`${tableB}.${columnB}`),
      ),
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

describe.skipIf(!integrationDatabaseEnabled())(
  'schema migration round trip',
  () => {
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
  },
)
