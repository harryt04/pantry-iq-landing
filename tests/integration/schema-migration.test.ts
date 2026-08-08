import { describe, expect, it } from 'vitest'

import {
  rollbackDatabase,
  migrateDatabase,
} from '../../src/server/db/migrations'
import { seedDatabase } from '../../src/server/db/seed-database'
import { withTestDatabase } from '../helpers/test-database'

const testcontainersEnabled = process.env.TESTCONTAINERS_ENABLED === '1'

describe.skipIf(!testcontainersEnabled)('schema migration round trip', () => {
  it('migrates, seeds, rolls back, and migrates again', async () => {
    await withTestDatabase(async (sql) => {
      await migrateDatabase(sql)

      const migratedTables = await sql<{ table_name: string | null }[]>`
        select to_regclass(table_name)::text as table_name
        from (values
          ('public.locations'),
          ('public.transactions'),
          ('public.csv_upload_history'),
          ('public.__drizzle_migrations')
        ) as tables(table_name)
      `
      expect(
        migratedTables.every(({ table_name }) => table_name !== null),
      ).toBe(true)

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
          ('public.transactions'),
          ('public.csv_upload_history'),
          ('public.__drizzle_migrations')
        ) as tables(table_name)
      `
      expect(
        rolledBackTables.every(({ table_name }) => table_name === null),
      ).toBe(true)

      await migrateDatabase(sql)
      const remigratedTables = await sql<{ table_name: string | null }[]>`
        select to_regclass(table_name)::text as table_name
        from (values
          ('public.locations'),
          ('public.transactions'),
          ('public.csv_upload_history'),
          ('public.__drizzle_migrations')
        ) as tables(table_name)
      `
      expect(
        remigratedTables.every(({ table_name }) => table_name !== null),
      ).toBe(true)
    })
  })
})
