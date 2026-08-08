import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export type DatabaseClient = ReturnType<typeof postgres>

export async function migrateDatabase(client: DatabaseClient) {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
}

export async function rollbackDatabase(client: DatabaseClient) {
  const appTables = [
    'csv_upload_history',
    'inventory_snapshots',
    'purchase_order_items',
    'transactions',
    'purchase_orders',
    'inventory_items',
    'locations',
  ] as const

  await client.begin(async (sql) => {
    for (const table of appTables) {
      await sql.unsafe(`DROP TABLE IF EXISTS public."${table}" CASCADE`)
    }
    await sql.unsafe('DROP TABLE IF EXISTS public."__drizzle_migrations"')
  })
}
