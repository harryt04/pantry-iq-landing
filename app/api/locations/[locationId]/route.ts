import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { LocationValidationError } from '@/src/server/locations/location-input'
import {
  LocationNotFoundError,
  updateLocation,
} from '@/src/server/locations/locations'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (
    error instanceof ForbiddenError ||
    error instanceof LocationNotFoundError
  ) {
    return Response.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof LocationValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json(
    { error: 'That location could not be updated. Try again.' },
    { status: 500 },
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { locationId } = await context.params
    const location = await updateLocation(
      await headers(),
      locationId,
      (await request.json()) as unknown,
    )
    return Response.json({ location })
  } catch (error) {
    return errorResponse(error)
  }
}
