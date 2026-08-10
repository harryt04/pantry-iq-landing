import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import {
  closeAppDatabaseClient,
  integrationDatabaseEnabled,
  openTestDatabase,
  type OpenTestDatabase,
} from '../helpers/test-database'

/**
 * `requireOwnedLocation` is the single account-isolation boundary in the
 * product. It is exercised against a real database because the thing under
 * test is the `where userId = ...` clause, which a mocked client would not
 * evaluate.
 */

type StubSession = {
  user: { id: string }
} | null

const sessionState: { current: StubSession } = { current: null }

vi.mock('@/src/server/auth/auth', () => ({
  auth: {
    api: {
      getSession: async () => sessionState.current,
    },
  },
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000a001'
const INTRUDER_ID = '00000000-0000-4000-8000-00000000a002'
const OWNED_LOCATION_ID = '00000000-0000-4000-8000-00000000b001'
const INTRUDER_LOCATION_ID = '00000000-0000-4000-8000-00000000b002'
const ABSENT_LOCATION_ID = '00000000-0000-4000-8000-00000000b999'
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let authorization: typeof import('../../src/server/auth/authorization')
let previousDatabaseUrl: string | undefined

describe.skipIf(!integrationDatabaseEnabled())('ownership boundary', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    await sql`
        insert into "user" (id, name, email)
        values
          (${OWNER_ID}, 'Owner', 'owner@example.com'),
          (${INTRUDER_ID}, 'Intruder', 'intruder@example.com')
      `
    await sql`
        insert into locations (id, user_id, name)
        values
          (${OWNED_LOCATION_ID}, ${OWNER_ID}, 'Owner Kitchen'),
          (${INTRUDER_LOCATION_ID}, ${INTRUDER_ID}, 'Intruder Kitchen')
      `

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    authorization = await import('../../src/server/auth/authorization')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  it('rejects a request that carries no session', async () => {
    sessionState.current = null

    await expect(
      authorization.requireOwnedLocation(new Headers(), OWNED_LOCATION_ID),
    ).rejects.toBeInstanceOf(authorization.UnauthorizedError)
  })

  it('returns the location when the caller owns it', async () => {
    sessionState.current = { user: { id: OWNER_ID } }

    const owned = await authorization.requireOwnedLocation(
      new Headers(),
      OWNED_LOCATION_ID,
    )

    expect(owned.locationId).toBe(OWNED_LOCATION_ID)
    expect(owned.session.user.id).toBe(OWNER_ID)
  })

  it('refuses a location that belongs to another account', async () => {
    sessionState.current = { user: { id: OWNER_ID } }

    await expect(
      authorization.requireOwnedLocation(new Headers(), INTRUDER_LOCATION_ID),
    ).rejects.toBeInstanceOf(authorization.ForbiddenError)
  })

  it('refuses a location that does not exist', async () => {
    sessionState.current = { user: { id: OWNER_ID } }

    await expect(
      authorization.requireOwnedLocation(new Headers(), ABSENT_LOCATION_ID),
    ).rejects.toBeInstanceOf(authorization.ForbiddenError)
  })

  it('refuses a malformed identifier before it reaches the database', async () => {
    sessionState.current = { user: { id: OWNER_ID } }

    for (const malformed of [
      'not-a-uuid',
      '',
      "' or '1'='1",
      `${OWNED_LOCATION_ID} `,
      OWNED_LOCATION_ID.replace('-4000-', '-0000-'),
    ]) {
      await expect(
        authorization.requireOwnedLocation(new Headers(), malformed),
      ).rejects.toBeInstanceOf(authorization.ForbiddenError)
    }
  })

  it('separates the two accounts in both directions', async () => {
    sessionState.current = { user: { id: INTRUDER_ID } }

    const own = await authorization.requireOwnedLocation(
      new Headers(),
      INTRUDER_LOCATION_ID,
    )
    expect(own.locationId).toBe(INTRUDER_LOCATION_ID)

    await expect(
      authorization.requireOwnedLocation(new Headers(), OWNED_LOCATION_ID),
    ).rejects.toBeInstanceOf(authorization.ForbiddenError)
  })

  it('requires a session before it considers ownership at all', async () => {
    sessionState.current = null

    await expect(
      authorization.requireSession(new Headers()),
    ).rejects.toBeInstanceOf(authorization.UnauthorizedError)

    sessionState.current = { user: { id: OWNER_ID } }
    const session = await authorization.requireSession(new Headers())
    expect(session.user.id).toBe(OWNER_ID)
  })
})
