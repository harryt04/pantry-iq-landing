import { and, eq } from 'drizzle-orm'

import { auth } from './auth'
import { db } from '@/src/server/db/client'
import { locations } from '@/src/server/db/schema'

export class UnauthorizedError extends Error {
  constructor() {
    super('You need to sign in to continue.')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('That record is not available to this account.')
    this.name = 'ForbiddenError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new UnauthorizedError()
  return session
}

/**
 * The ownership predicate lives here so every future location-scoped query
 * can enforce the same account boundary at the database query layer.
 */
export async function requireOwnedLocation(
  headers: Headers,
  locationId: string,
) {
  const session = await requireSession(headers)
  if (!uuidPattern.test(locationId)) throw new ForbiddenError()

  const ownedLocation = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.userId, session.user.id)),
    )
    .limit(1)

  if (!ownedLocation[0]) throw new ForbiddenError()
  return { session, locationId: ownedLocation[0].id }
}
