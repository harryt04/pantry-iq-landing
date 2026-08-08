import { and, asc, desc, eq } from 'drizzle-orm'

import {
  requireSession,
  requireOwnedLocation,
} from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { locations } from '@/src/server/db/schema'

import {
  validateLocationCreateInput,
  validateLocationUpdateInput,
} from './location-input'

export class LocationNotFoundError extends Error {
  constructor() {
    super('That location is not available to this account.')
    this.name = 'LocationNotFoundError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireUuid(locationId: string) {
  if (!uuidPattern.test(locationId)) throw new LocationNotFoundError()
}

export async function listLocations(headers: Headers) {
  const session = await requireSession(headers)
  return db
    .select()
    .from(locations)
    .where(eq(locations.userId, session.user.id))
    .orderBy(desc(locations.isActive), asc(locations.name), asc(locations.id))
}

export async function createLocation(headers: Headers, input: unknown) {
  const session = await requireSession(headers)
  const values = validateLocationCreateInput(input)
  const [location] = await db
    .insert(locations)
    .values({ userId: session.user.id, ...values })
    .returning()
  return location
}

export async function updateLocation(
  headers: Headers,
  locationId: string,
  input: unknown,
) {
  requireUuid(locationId)
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  const values = validateLocationUpdateInput(input)
  const [location] = await db
    .update(locations)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(locations.id, ownedLocation.locationId),
        eq(locations.userId, ownedLocation.session.user.id),
      ),
    )
    .returning()

  if (!location) throw new LocationNotFoundError()
  return location
}
