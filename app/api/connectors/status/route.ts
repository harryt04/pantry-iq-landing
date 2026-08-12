import { headers } from 'next/headers'

import {
  UnauthorizedError,
  ForbiddenError,
  requireOwnedLocation,
} from '@/src/server/auth/authorization'
import { listConnectorConnectionStatuses } from '@/src/server/connectors/framework'

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get('locationId')
    const requestHeaders = await headers()
    if (locationId) await requireOwnedLocation(requestHeaders, locationId)
    return Response.json({
      connections: await listConnectorConnectionStatuses({
        headers: requestHeaders,
        ...(locationId ? { locationId } : {}),
      }),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError)
      return Response.json({ error: error.message }, { status: 403 })
    return Response.json(
      { error: 'Connector status is not available.' },
      { status: 500 },
    )
  }
}
