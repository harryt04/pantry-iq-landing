import { PostgreSqlContainer } from '@testcontainers/postgresql'
import postgres from 'postgres'

type TestSql = ReturnType<typeof postgres>

const localHosts = new Set(['localhost', '127.0.0.1', '::1'])

function getExternalTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl) return undefined

  let hostname: string
  try {
    hostname = new URL(databaseUrl).hostname
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.')
  }

  if (!localHosts.has(hostname)) {
    throw new Error(
      'TEST_DATABASE_URL must point to localhost because integration tests reset the database.',
    )
  }

  return databaseUrl
}

export const integrationDatabaseEnabled = () =>
  Boolean(getExternalTestDatabaseUrl()) ||
  process.env.TESTCONTAINERS_ENABLED === '1'

/**
 * Uses an explicitly supplied disposable local database when available.
 * Otherwise starts an isolated PostgreSQL instance for integration tests.
 * The caller owns no database lifecycle; this helper always closes or tears
 * down the database it opened.
 */
export async function withTestDatabase<T>(
  callback: (sql: TestSql) => Promise<T>,
): Promise<T> {
  const externalDatabaseUrl = getExternalTestDatabaseUrl()
  if (externalDatabaseUrl) {
    const sql = postgres(externalDatabaseUrl, { max: 1 })
    try {
      return await callback(sql)
    } finally {
      await sql.end()
    }
  }

  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const sql = postgres(container.getConnectionUri(), { max: 1 })

  try {
    return await callback(sql)
  } finally {
    await sql.end()
    await container.stop()
  }
}
