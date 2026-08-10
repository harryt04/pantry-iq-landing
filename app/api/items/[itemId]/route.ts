import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { InventoryItemValidationError } from '@/src/server/inventory/item-input'
import {
  InventoryItemNotFoundError,
  updateInventoryItem,
} from '@/src/server/inventory/items'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (
    error instanceof ForbiddenError ||
    error instanceof InventoryItemNotFoundError
  ) {
    return Response.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof InventoryItemValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json(
    { error: 'That item could not be updated. Try again.' },
    { status: 500 },
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const locationId = new URL(request.url).searchParams.get('locationId')
  if (!locationId) {
    return Response.json({ error: 'locationId is required.' }, { status: 400 })
  }

  try {
    const { itemId } = await context.params
    const item = await updateInventoryItem(
      await headers(),
      locationId,
      itemId,
      (await request.json()) as unknown,
    )
    return Response.json({ item })
  } catch (error) {
    return errorResponse(error)
  }
}
