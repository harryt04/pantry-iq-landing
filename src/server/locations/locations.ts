import { and, asc, count, desc, eq, sql, sum } from 'drizzle-orm'

import {
  requireSession,
  requireOwnedLocation,
} from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  csvUploadHistory,
  inventoryItems,
  inventorySnapshots,
  locations,
  purchaseOrderItems,
  purchaseOrders,
  recipes,
  transactions,
} from '@/src/server/db/schema'

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

export type AccountResumeState =
  | { status: 'no-location' }
  | { status: 'has-data' }
  | { status: 'needs-import'; locationId: string }

/**
 * Decide where a signed-in operator should resume before the account page
 * renders. This keeps the first-session path for accounts that have created a
 * location but have not imported anything, without hiding the account page
 * during ordinary navigation.
 */
export async function getAccountResumeState(
  headers: Headers,
  preferredLocationId?: string,
): Promise<AccountResumeState> {
  const session = await requireSession(headers)
  const activeLocations = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.userId, session.user.id), eq(locations.isActive, true)),
    )
    .orderBy(asc(locations.name), asc(locations.id))

  if (activeLocations.length === 0) return { status: 'no-location' }

  const [importedUpload] = await db
    .select({ id: csvUploadHistory.id })
    .from(csvUploadHistory)
    .innerJoin(locations, eq(locations.id, csvUploadHistory.locationId))
    .where(
      and(
        eq(locations.userId, session.user.id),
        eq(csvUploadHistory.status, 'imported'),
      ),
    )
    .limit(1)

  if (importedUpload) return { status: 'has-data' }

  const preferredLocation = activeLocations.find(
    (location) => location.id === preferredLocationId,
  )
  return {
    status: 'needs-import',
    locationId: preferredLocation?.id ?? activeLocations[0]!.id,
  }
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

export type LocationDeletionSummary = {
  locationName: string
  importCount: number
  importedRowCount: number
}

export async function getLocationDeletionSummary(
  headers: Headers,
  locationId: string,
): Promise<LocationDeletionSummary> {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  const [location] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, ownedLocation.locationId))
    .limit(1)

  if (!location) throw new LocationNotFoundError()

  const [summary] = await db
    .select({
      importCount: count(csvUploadHistory.id),
      importedRowCount: sql<number>`coalesce(${sum(csvUploadHistory.rowsImported)}, 0)`,
    })
    .from(csvUploadHistory)
    .where(eq(csvUploadHistory.locationId, ownedLocation.locationId))

  return {
    locationName: location.name,
    importCount: Number(summary?.importCount ?? 0),
    importedRowCount: Number(summary?.importedRowCount ?? 0),
  }
}

export async function deleteLocation(headers: Headers, locationId: string) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)

  await db.transaction(async (tx) => {
    await tx
      .delete(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, ownedLocation.locationId))
    await tx
      .delete(transactions)
      .where(eq(transactions.locationId, ownedLocation.locationId))
    await tx
      .delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.locationId, ownedLocation.locationId))
    await tx
      .delete(purchaseOrders)
      .where(eq(purchaseOrders.locationId, ownedLocation.locationId))
    await tx
      .delete(csvUploadHistory)
      .where(eq(csvUploadHistory.locationId, ownedLocation.locationId))
    await tx
      .delete(recipes)
      .where(eq(recipes.locationId, ownedLocation.locationId))
    await tx
      .delete(inventoryItems)
      .where(eq(inventoryItems.locationId, ownedLocation.locationId))
    await tx.delete(locations).where(eq(locations.id, ownedLocation.locationId))
  })
}
