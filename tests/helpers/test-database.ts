import { PostgreSqlContainer } from '@testcontainers/postgresql'
import postgres from 'postgres'

type TestSql = ReturnType<typeof postgres>

export type TestDatabase = {
  sql: TestSql
  url: string
}

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

/**
 * Integration suites skip themselves when no database is reachable, which is
 * right on a laptop without Docker and wrong in CI: the run goes green having
 * tested nothing. Set REQUIRE_INTEGRATION_DB=1 wherever a skip should be a
 * failure instead.
 */
export const integrationDatabaseEnabled = () => {
  const enabled =
    Boolean(getExternalTestDatabaseUrl()) ||
    process.env.TESTCONTAINERS_ENABLED === '1'

  if (!enabled && process.env.REQUIRE_INTEGRATION_DB === '1') {
    throw new Error(
      'REQUIRE_INTEGRATION_DB=1 but no test database is available. ' +
        'Set TEST_DATABASE_URL to a localhost PostgreSQL URL, or set ' +
        'TESTCONTAINERS_ENABLED=1 with Docker running.',
    )
  }

  return enabled
}

/**
 * Uses an explicitly supplied disposable local database when available.
 * Otherwise starts an isolated PostgreSQL instance for integration tests.
 * The caller owns no database lifecycle; this helper always closes or tears
 * down the database it opened.
 */
export async function withTestDatabase<T>(
  callback: (sql: TestSql) => Promise<T>,
): Promise<T> {
  return withTestDatabaseUrl(async ({ sql }) => callback(sql))
}

/**
 * Provides both the client and connection URL so code that creates its own
 * database client can point at the same disposable database as the test.
 */
export async function withTestDatabaseUrl<T>(
  callback: (database: TestDatabase) => Promise<T>,
): Promise<T> {
  const { database, close } = await openTestDatabase()
  try {
    return await callback(database)
  } finally {
    await close()
  }
}

export type OpenTestDatabase = {
  database: TestDatabase
  close: () => Promise<void>
}

/**
 * Closes every application connection pool opened during a test.
 *
 * A test that points DATABASE_URL at a disposable database and then imports a
 * service leaves two pools open: the drizzle client in `src/server/db/client`,
 * and pg-boss inside `src/server/metrics/scheduler`. Stopping the container
 * underneath them raises "terminating connection due to administrator command"
 * after the suite has already passed. Call this before closing the database.
 */
export async function closeAppDatabaseClient() {
  if (process.env.DATABASE_URL === undefined) return

  try {
    const { stopPrecomputeScheduler } =
      await import('@/src/server/metrics/scheduler')
    await stopPrecomputeScheduler()
  } catch {
    // The scheduler was never started, so there is nothing to stop.
  }

  // Application modules import the client through the '@' alias. Vitest keys
  // its module registry by resolved specifier, so importing the same file by a
  // relative path can hand back a second instance whose pool is not the one
  // holding connections. Close both.
  for (const specifier of [
    '@/src/server/db/client',
    '../../src/server/db/client',
  ]) {
    try {
      const { db } = (await import(/* @vite-ignore */ specifier)) as {
        db: { $client?: { end?: (o?: { timeout?: number }) => Promise<void> } }
      }
      await db.$client?.end?.({ timeout: 5 })
    } catch {
      // Not loaded under this specifier, so there is nothing to close.
    }
  }
}

/**
 * Opens a disposable database for the lifetime of a whole test file.
 *
 * `withTestDatabase` starts and stops a container per call, which costs about
 * ten seconds each time. A file that needs many separate `it` blocks against
 * one schema should open once in `beforeAll` and close in `afterAll`. The
 * caller owns the returned `close` and must always call it.
 */
export async function openTestDatabase(): Promise<OpenTestDatabase> {
  const externalDatabaseUrl = getExternalTestDatabaseUrl()
  if (externalDatabaseUrl !== undefined) {
    const sql = postgres(externalDatabaseUrl, { max: 1, onnotice: () => {} })
    return {
      database: { sql, url: externalDatabaseUrl },
      close: async () => {
        await sql.end()
      },
    }
  }

  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const sql = postgres(container.getConnectionUri(), {
    max: 1,
    onnotice: () => {},
  })

  return {
    database: { sql, url: container.getConnectionUri() },
    close: async () => {
      await sql.end()
      await container.stop()
    },
  }
}
