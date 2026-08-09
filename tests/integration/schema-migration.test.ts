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
  'account',
  'locations',
  'inventory_items',
  'transactions',
  'purchase_orders',
  'purchase_order_items',
  'inventory_snapshots',
  'csv_upload_history',
  'session',
  'user',
  'verification',
  'recipes',
  'recipe_ingredients',
  'item_unit_conversions',
  'recipe_cost_history',
  'metric_runs',
  'metric_results',
  'metric_rollups',
] as const

const canonicalIndexes = [
  'inventory_items_location_canonical_name_idx',
  'inventory_snapshots_location_counted_at_idx',
  'purchase_order_items_location_inventory_item_idx',
  'purchase_orders_location_source_external_id_idx',
  'transactions_location_transacted_at_idx',
  'transactions_location_menu_item_idx',
  'transactions_location_source_external_id_idx',
  'recipes_location_idx',
  'recipes_location_menu_item_name_idx',
  'recipe_ingredients_recipe_id_idx',
  'recipe_ingredients_ingredient_item_id_idx',
  'item_unit_conversions_item_units_idx',
  'recipe_cost_history_location_recipe_calculated_idx',
  'csv_upload_history_storage_key_idx',
  'metric_runs_location_started_at_idx',
  'metric_runs_location_status_idx',
  'metric_results_run_item_key_idx',
  'metric_results_location_item_key_idx',
  'metric_rollups_run_key_idx',
  'metric_rollups_location_key_idx',
] as const

const canonicalColumns = [
  ['account', 'id', false, 'uuid'],
  ['account', 'user_id', false, 'uuid'],
  ['account', 'account_id', false, 'text'],
  ['account', 'provider_id', false, 'text'],
  ['account', 'access_token', true, 'text'],
  ['account', 'refresh_token', true, 'text'],
  ['account', 'access_token_expires_at', true, 'timestamp with time zone'],
  ['account', 'refresh_token_expires_at', true, 'timestamp with time zone'],
  ['account', 'scope', true, 'text'],
  ['account', 'id_token', true, 'text'],
  ['account', 'password', true, 'text'],
  ['account', 'created_at', false, 'timestamp with time zone'],
  ['account', 'updated_at', false, 'timestamp with time zone'],
  ['locations', 'id', false, 'uuid'],
  ['locations', 'user_id', false, 'uuid'],
  ['locations', 'name', false, 'text'],
  ['locations', 'address', true, 'text'],
  ['locations', 'is_active', false, 'boolean'],
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
  ['inventory_items', 'item_type', false, 'text'],
  ['inventory_items', 'shelf_life_days', true, 'integer'],
  ['inventory_items', 'cost_per_unit', true, 'numeric'],
  ['inventory_items', 'menu_price', true, 'numeric'],
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
  ['csv_upload_history', 'item_resolution', true, 'jsonb'],
  ['csv_upload_history', 'unmatched_items', true, 'jsonb'],
  ['csv_upload_history', 'storage_key', true, 'text'],
  ['csv_upload_history', 'status', false, 'text'],
  ['csv_upload_history', 'uploaded_at', false, 'timestamp with time zone'],
  ['csv_upload_history', 'created_at', false, 'timestamp with time zone'],
  ['session', 'id', false, 'uuid'],
  ['session', 'user_id', false, 'uuid'],
  ['session', 'token', false, 'text'],
  ['session', 'expires_at', false, 'timestamp with time zone'],
  ['session', 'ip_address', true, 'text'],
  ['session', 'user_agent', true, 'text'],
  ['session', 'created_at', false, 'timestamp with time zone'],
  ['session', 'updated_at', false, 'timestamp with time zone'],
  ['user', 'id', false, 'uuid'],
  ['user', 'name', false, 'text'],
  ['user', 'company_name', true, 'text'],
  ['user', 'email', false, 'text'],
  ['user', 'email_verified', false, 'boolean'],
  ['user', 'image', true, 'text'],
  ['user', 'created_at', false, 'timestamp with time zone'],
  ['user', 'updated_at', false, 'timestamp with time zone'],
  ['verification', 'id', false, 'uuid'],
  ['verification', 'identifier', false, 'text'],
  ['verification', 'value', false, 'text'],
  ['verification', 'expires_at', false, 'timestamp with time zone'],
  ['verification', 'created_at', false, 'timestamp with time zone'],
  ['verification', 'updated_at', false, 'timestamp with time zone'],
  ['recipes', 'id', false, 'uuid'],
  ['recipes', 'location_id', false, 'uuid'],
  ['recipes', 'menu_item_id', false, 'uuid'],
  ['recipes', 'name', false, 'text'],
  ['recipes', 'output_quantity', false, 'numeric'],
  ['recipes', 'output_unit', false, 'text'],
  ['recipes', 'yield_factor', false, 'numeric'],
  ['recipes', 'waste_factor', false, 'numeric'],
  ['recipes', 'is_active', false, 'boolean'],
  ['recipes', 'created_at', false, 'timestamp with time zone'],
  ['recipes', 'updated_at', false, 'timestamp with time zone'],
  ['recipe_ingredients', 'id', false, 'uuid'],
  ['recipe_ingredients', 'recipe_id', false, 'uuid'],
  ['recipe_ingredients', 'ingredient_item_id', true, 'uuid'],
  ['recipe_ingredients', 'sub_recipe_id', true, 'uuid'],
  ['recipe_ingredients', 'quantity', false, 'numeric'],
  ['recipe_ingredients', 'unit', false, 'text'],
  ['recipe_ingredients', 'created_at', false, 'timestamp with time zone'],
  ['item_unit_conversions', 'id', false, 'uuid'],
  ['item_unit_conversions', 'location_id', false, 'uuid'],
  ['item_unit_conversions', 'inventory_item_id', false, 'uuid'],
  ['item_unit_conversions', 'from_unit', false, 'text'],
  ['item_unit_conversions', 'to_unit', false, 'text'],
  ['item_unit_conversions', 'factor', false, 'numeric'],
  ['item_unit_conversions', 'created_at', false, 'timestamp with time zone'],
  ['item_unit_conversions', 'updated_at', false, 'timestamp with time zone'],
  ['recipe_cost_history', 'id', false, 'uuid'],
  ['recipe_cost_history', 'location_id', false, 'uuid'],
  ['recipe_cost_history', 'recipe_id', false, 'uuid'],
  ['recipe_cost_history', 'calculated_at', false, 'timestamp with time zone'],
  ['recipe_cost_history', 'status', false, 'text'],
  ['recipe_cost_history', 'batch_cost', true, 'numeric'],
  ['recipe_cost_history', 'cost_per_output', true, 'numeric'],
  ['recipe_cost_history', 'menu_price', true, 'numeric'],
  ['recipe_cost_history', 'plate_margin', true, 'numeric'],
  ['recipe_cost_history', 'food_cost_percentage', true, 'numeric'],
  ['recipe_cost_history', 'evidence', false, 'jsonb'],
  ['recipe_cost_history', 'created_at', false, 'timestamp with time zone'],
  ['metric_runs', 'id', false, 'uuid'],
  ['metric_runs', 'location_id', false, 'uuid'],
  ['metric_runs', 'status', false, 'text'],
  ['metric_runs', 'input_window_start', false, 'timestamp with time zone'],
  ['metric_runs', 'input_window_end', false, 'timestamp with time zone'],
  ['metric_runs', 'started_at', false, 'timestamp with time zone'],
  ['metric_runs', 'completed_at', true, 'timestamp with time zone'],
  ['metric_runs', 'error', true, 'text'],
  ['metric_runs', 'created_at', false, 'timestamp with time zone'],
  ['metric_results', 'id', false, 'uuid'],
  ['metric_results', 'run_id', false, 'uuid'],
  ['metric_results', 'location_id', false, 'uuid'],
  ['metric_results', 'inventory_item_id', false, 'uuid'],
  ['metric_results', 'metric_key', false, 'text'],
  ['metric_results', 'status', false, 'text'],
  ['metric_results', 'value', true, 'numeric'],
  ['metric_results', 'result', false, 'jsonb'],
  ['metric_results', 'created_at', false, 'timestamp with time zone'],
  ['metric_rollups', 'id', false, 'uuid'],
  ['metric_rollups', 'run_id', false, 'uuid'],
  ['metric_rollups', 'location_id', false, 'uuid'],
  ['metric_rollups', 'metric_key', false, 'text'],
  ['metric_rollups', 'status', false, 'text'],
  ['metric_rollups', 'value', true, 'numeric'],
  ['metric_rollups', 'result', false, 'jsonb'],
  ['metric_rollups', 'created_at', false, 'timestamp with time zone'],
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
    columns
      .map(({ table_name, column_name, is_nullable, data_type }) => [
        table_name,
        column_name,
        is_nullable === 'YES',
        data_type,
      ])
      .sort(([tableA, columnA], [tableB, columnB]) =>
        `${tableA}.${columnA}`.localeCompare(`${tableB}.${columnB}`),
      ),
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

  const migrationJournal = await sql<
    {
      schema_name: string
      table_name: string
    }[]
  >`
    select table_schema as schema_name, table_name
    from information_schema.tables
    where table_schema = 'drizzle'
      and table_name = '__drizzle_migrations'
  `
  expect(migrationJournal).toEqual([
    { schema_name: 'drizzle', table_name: '__drizzle_migrations' },
  ])

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

// Starting a real PostgreSQL testcontainer (image pull + boot) routinely
// exceeds vitest's 5s default timeout on CI runners.
const CONTAINER_TEST_TIMEOUT_MS = 60_000

describe.skipIf(!integrationDatabaseEnabled())(
  'schema migration round trip',
  () => {
    it(
      'migrates, seeds, rolls back, and migrates again',
      async () => {
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
          ('public.account'),
          ('public.session'),
          ('public.verification'),
          ('public.user'),
          ('public.recipes'),
          ('public.recipe_ingredients'),
          ('public.item_unit_conversions'),
          ('public.metric_runs'),
          ('public.metric_results'),
          ('public.metric_rollups'),
          ('drizzle.__drizzle_migrations')
        ) as tables(table_name)
      `
          expect(
            rolledBackTables.every(({ table_name }) => table_name === null),
          ).toBe(true)

          await migrateDatabase(sql)
          await expectCanonicalSchema(sql)
        })
      },
      CONTAINER_TEST_TIMEOUT_MS,
    )
  },
)
