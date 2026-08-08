import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/src/server/db/client'
import { inventoryItems } from '@/src/server/db/schema'
import { requireOwnedLocation } from '@/src/server/auth/authorization'

import {
  InventoryItemValidationError,
  validateInventoryItemCreateInput,
  validateInventoryItemUpdateInput,
} from './item-input'

export class InventoryItemNotFoundError extends Error {
  constructor() {
    super('That item is not available to this account.')
    this.name = 'InventoryItemNotFoundError'
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireUuid(value: string, field: string) {
  if (!uuidPattern.test(value)) {
    throw new InventoryItemValidationError(`${field} must be a UUID.`)
  }
}

export async function createInventoryItem(
  headers: Headers,
  locationId: string,
  input: unknown,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  const values = validateInventoryItemCreateInput(input)

  const [item] = await db
    .insert(inventoryItems)
    .values({ locationId: ownedLocation.locationId, ...values })
    .returning()

  return item
}

export async function listInventoryItems(
  headers: Headers,
  locationId: string,
  options: { includeInactive?: boolean } = {},
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  const predicates = [eq(inventoryItems.locationId, ownedLocation.locationId)]
  if (!options.includeInactive) {
    predicates.push(eq(inventoryItems.isActive, true))
  }

  return db
    .select()
    .from(inventoryItems)
    .where(and(...predicates))
    .orderBy(asc(inventoryItems.displayName), asc(inventoryItems.id))
}

export async function getInventoryItem(
  headers: Headers,
  locationId: string,
  itemId: string,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  requireUuid(itemId, 'itemId')

  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.locationId, ownedLocation.locationId),
      ),
    )
    .limit(1)

  if (!item) throw new InventoryItemNotFoundError()
  return item
}

export async function updateInventoryItem(
  headers: Headers,
  locationId: string,
  itemId: string,
  input: unknown,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  requireUuid(itemId, 'itemId')
  const values = validateInventoryItemUpdateInput(input)

  const [item] = await db
    .update(inventoryItems)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.locationId, ownedLocation.locationId),
      ),
    )
    .returning()

  if (!item) throw new InventoryItemNotFoundError()
  return item
}

/** Increment references from a transaction or purchase-order import. */
export async function incrementInventoryItemUsage(
  headers: Headers,
  locationId: string,
  itemId: string,
  amount = 1,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  requireUuid(itemId, 'itemId')
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new InventoryItemValidationError(
      'usage increment must be a positive integer.',
    )
  }

  const [item] = await db
    .update(inventoryItems)
    .set({
      usageCount: sql`${inventoryItems.usageCount} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.locationId, ownedLocation.locationId),
      ),
    )
    .returning()

  if (!item) throw new InventoryItemNotFoundError()
  return item
}
