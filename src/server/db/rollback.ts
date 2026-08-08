import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for rollback.')
if (process.env.ALLOW_DB_ROLLBACK !== '1') {
  throw new Error(
    'Rollback is destructive. Set ALLOW_DB_ROLLBACK=1 to continue.',
  )
}

const parsedUrl = new URL(databaseUrl)
if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) {
  throw new Error('Rollback is limited to a local PostgreSQL database.')
}

const client = postgres(databaseUrl, { max: 1 })
const appTables = [
  'csv_upload_history',
  'inventory_snapshots',
  'purchase_order_items',
  'transactions',
  'purchase_orders',
  'inventory_items',
  'locations',
] as const

try {
  await client.begin(async (sql) => {
    for (const table of appTables) {
      await sql.unsafe(`DROP TABLE IF EXISTS public."${table}" CASCADE`)
    }
    await sql.unsafe('DROP TABLE IF EXISTS public."__drizzle_migrations"')
  })
} finally {
  await client.end()
}
