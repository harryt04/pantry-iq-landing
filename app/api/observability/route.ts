import {
  ForbiddenError,
  requireOwnedLocation,
  requireSession,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { listLocations } from '@/src/server/locations/locations'
import {
  getImportHealth,
  getPrecomputeHealth,
  listDailyLlmSpend,
} from '@/src/server/observability/store'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError)
    return Response.json({ error: error.message }, { status: 401 })
  if (error instanceof ForbiddenError)
    return Response.json({ error: error.message }, { status: 404 })
  return Response.json(
    { error: 'Observability is not available right now.' },
    { status: 500 },
  )
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request.headers)
    const locationId = new URL(request.url).searchParams.get('locationId')

    const ownedLocations: Array<{ id: string; name?: string }> = locationId
      ? [
          {
            id: (await requireOwnedLocation(request.headers, locationId))
              .locationId,
          },
        ]
      : await listLocations(request.headers)

    return Response.json({
      locations: await Promise.all(
        ownedLocations.map(async (location) => ({
          id: location.id,
          ...(location.name ? { name: location.name } : {}),
          precompute: await getPrecomputeHealth(location.id),
          imports: await getImportHealth(location.id),
        })),
      ),
      llmSpend: await listDailyLlmSpend(session.user.id),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
