import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
  requireOwnedLocation,
} from '@/src/server/auth/authorization'
import {
  refreshLocationReconciliation,
  resolveReconciliationConflict,
} from '@/src/server/ingestion/reconciliation'
import { enqueuePrecomputeForLocation } from '@/src/server/metrics/scheduler'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof ForbiddenError)
    return Response.json({ error: error.message }, { status: 403 })
  return Response.json(
    { error: 'Reconciliation is not available.' },
    { status: 404 },
  )
}

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get('locationId')
    if (!locationId)
      return Response.json({ error: 'Choose a location.' }, { status: 400 })
    await requireOwnedLocation(await headers(), locationId)
    return Response.json({
      conflicts: await refreshLocationReconciliation(locationId),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      locationId?: string
      conflictId?: string
      authoritySource?: string
    }
    if (!body.locationId || !body.conflictId || !body.authoritySource)
      return Response.json(
        { error: 'Choose a location, overlap, and source.' },
        { status: 400 },
      )
    await requireOwnedLocation(await headers(), body.locationId)
    const conflict = await resolveReconciliationConflict({
      locationId: body.locationId,
      conflictId: body.conflictId,
      authoritySource: body.authoritySource,
    })
    if (!conflict)
      return Response.json(
        { error: 'That overlap is no longer available.' },
        { status: 404 },
      )
    await enqueuePrecomputeForLocation(body.locationId).catch(() => undefined)
    return Response.json({ conflict })
  } catch (error) {
    return errorResponse(error)
  }
}
