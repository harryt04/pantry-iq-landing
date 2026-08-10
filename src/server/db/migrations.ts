import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export type DatabaseClient = ReturnType<typeof postgres>

export async function migrateDatabase(client: DatabaseClient) {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
}

export async function rollbackDatabase(client: DatabaseClient) {
  const appTables = [
    'connector_webhook_deliveries',
    'connector_oauth_states',
    'connector_connections',
    'external_signals',
    'external_signal_fetches',
    'reconciliation_conflicts',
    'observability_events',
    'metric_rollups',
    'metric_results',
    'metric_runs',
    'recipe_cost_history',
    'csv_upload_history',
    'item_unit_conversions',
    'recipe_ingredients',
    'recipes',
    'inventory_snapshots',
    'purchase_order_items',
    'transactions',
    'labor_shifts',
    'purchase_orders',
    'inventory_items',
    'locations',
    'account',
    'session',
    'verification',
    'user',
  ] as const

  await client.begin(async (sql) => {
    for (const table of appTables) {
      await sql.unsafe(`DROP TABLE IF EXISTS public."${table}" CASCADE`)
    }
    // drizzle-orm's PostgreSQL migrator keeps its journal in the dedicated
    // `drizzle` schema, not alongside application tables in `public`.
    await sql.unsafe('DROP TABLE IF EXISTS drizzle."__drizzle_migrations"')
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle')
  })
}
