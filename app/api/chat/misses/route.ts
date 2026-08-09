import {
  ForbiddenError,
  requireSession,
  requireOwnedLocation,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { chatMisses } from '@/src/server/chat/misses'

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get('locationId')
    const owned = locationId
      ? await requireOwnedLocation(request.headers, locationId)
      : undefined
    const session = owned?.session ?? (await requireSession(request.headers))
    return Response.json({
      report: chatMisses.report(session.user.id, owned?.locationId),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 404 })
    }
    return Response.json(
      { error: 'The chat miss report is not available.' },
      { status: 500 },
    )
  }
}
