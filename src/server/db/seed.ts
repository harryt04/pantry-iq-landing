import postgres from 'postgres'

import { seedDatabase } from './seed-database'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for seeding.')

const client = postgres(databaseUrl, { max: 1 })

try {
  await seedDatabase(client)
} finally {
  await client.end()
}
