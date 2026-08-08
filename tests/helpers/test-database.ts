import { PostgreSqlContainer } from '@testcontainers/postgresql'
import postgres from 'postgres'

type TestSql = ReturnType<typeof postgres>

/**
 * Starts an isolated PostgreSQL instance for integration tests.
 * The caller owns no container lifecycle; this helper always tears it down.
 */
export async function withTestDatabase<T>(
  callback: (sql: TestSql) => Promise<T>,
): Promise<T> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const sql = postgres(container.getConnectionUri(), { max: 1 })

  try {
    return await callback(sql)
  } finally {
    await sql.end()
    await container.stop()
  }
}
