import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../drizzle/0001_fancy_the_leader.sql', import.meta.url),
  'utf8',
)
const authConfig = readFileSync(
  new URL('../../src/server/auth/auth.ts', import.meta.url),
  'utf8',
)

describe('authentication migration contract', () => {
  it('creates Better Auth core tables with UUID ownership-compatible IDs', () => {
    for (const table of ['user', 'session', 'account', 'verification']) {
      expect(migration).toContain(`CREATE TABLE "${table}"`)
    }

    expect(migration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade',
    )
    expect(migration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade',
    )
  })

  it('does not add social-provider tables or product notification tables', () => {
    expect(migration).not.toMatch(/oauth|notification|webhook/i)
  })

  it('configures Better Auth to generate UUIDs for the UUID-backed schema', () => {
    expect(authConfig).toMatch(/generateId:\s*['"]uuid['"]/)
  })
})
