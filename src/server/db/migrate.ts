import postgres from 'postgres'

import { migrateDatabase } from './migrations'

const connectionString = process.env.DATABASE_URL
if (!connectionString)
  throw new Error('DATABASE_URL is required for migrations.')

const client = postgres(connectionString, { max: 1 })
await migrateDatabase(client)
await client.end()
