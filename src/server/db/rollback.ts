import postgres from 'postgres'

import { rollbackDatabase } from './migrations'

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

try {
  await rollbackDatabase(client)
} finally {
  await client.end()
}
