import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export type DatabaseClient = ReturnType<typeof postgres>

export async function migrateDatabase(client: DatabaseClient) {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
}

export async function rollbackDatabase(client: DatabaseClient) {
  const appTables = [
    'item_unit_conversions',
    'recipe_ingredients',
    'recipes',
    'csv_upload_history',
    'inventory_snapshots',
    'purchase_order_items',
    'transactions',
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
