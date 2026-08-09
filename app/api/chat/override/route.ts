import { headers } from 'next/headers'

import {
  compareAssumptionOverride,
  parseAssumptionOverride,
} from '@/src/server/chat/assumption-override'
import {
  ForbiddenError,
  requireOwnedLocation,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { loadPrecomputeInput } from '@/src/server/metrics/precompute'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof ForbiddenError)
    return Response.json({ error: error.message }, { status: 404 })
  if (error instanceof Error)
    return Response.json({ error: error.message }, { status: 400 })
  return Response.json(
    { error: 'The assumption could not be recalculated.' },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { locationId?: unknown }
    if (typeof body.locationId !== 'string' || !body.locationId.trim()) {
      return Response.json(
        { error: 'locationId is required.' },
        { status: 400 },
      )
    }
    const owned = await requireOwnedLocation(await headers(), body.locationId)
    const override = parseAssumptionOverride(body)
    const comparison = compareAssumptionOverride(
      await loadPrecomputeInput(owned.locationId),
      override,
      new Date(),
    )
    return Response.json({ comparison, override })
  } catch (error) {
    return errorResponse(error)
  }
}
