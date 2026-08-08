import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { ManualEntryValidationError } from '@/src/server/manual/manual-entry'
import { createManualEntry } from '@/src/server/manual/manual-entry'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof ForbiddenError)
    return Response.json({ error: error.message }, { status: 404 })
  if (error instanceof ManualEntryValidationError)
    return Response.json({ error: error.message }, { status: 400 })
  return Response.json(
    { error: 'The manual entry could not be saved. Nothing was changed.' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const locationId = new URL(request.url).searchParams.get('locationId')
  if (!locationId)
    return Response.json({ error: 'locationId is required.' }, { status: 400 })

  try {
    const result = await createManualEntry(
      await headers(),
      locationId,
      await request.json(),
    )
    return Response.json({ result }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
