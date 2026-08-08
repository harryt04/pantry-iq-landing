import { headers } from 'next/headers'

import { UnauthorizedError } from '@/src/server/auth/authorization'
import { createLocation, listLocations } from '@/src/server/locations/locations'
import { LocationValidationError } from '@/src/server/locations/location-input'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof LocationValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json(
    { error: 'Locations could not be loaded. Try again.' },
    { status: 500 },
  )
}

export async function GET() {
  try {
    return Response.json({ locations: await listLocations(await headers()) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const location = await createLocation(
      await headers(),
      (await request.json()) as unknown,
    )
    return Response.json({ location }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
