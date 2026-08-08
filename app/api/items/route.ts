import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { InventoryItemValidationError } from '@/src/server/inventory/item-input'
import { listInventoryItems } from '@/src/server/inventory/items'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof InventoryItemValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json(
    { error: 'Items could not be loaded. Try again.' },
    { status: 500 },
  )
}

function publicItem(
  item: Awaited<ReturnType<typeof listInventoryItems>>[number],
) {
  return {
    id: item.id,
    canonicalName: item.canonicalName,
    displayName: item.displayName,
    category: item.category,
    unit: item.unit,
    itemType: item.itemType,
    shelfLifeDays: item.shelfLifeDays,
    costPerUnit: item.costPerUnit,
    usageCount: item.usageCount,
    isActive: item.isActive,
    updatedAt: item.updatedAt,
  }
}

export async function GET(request: Request) {
  const locationId = new URL(request.url).searchParams.get('locationId')
  if (!locationId) {
    return Response.json({ error: 'locationId is required.' }, { status: 400 })
  }

  try {
    const items = await listInventoryItems(await headers(), locationId, {
      includeInactive: true,
    })
    return Response.json({ items: items.map(publicItem) })
  } catch (error) {
    return errorResponse(error)
  }
}
