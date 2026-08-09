import {
  requireSession,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { chatMisses } from '@/src/server/chat/misses'

export async function GET(request: Request) {
  try {
    const session = await requireSession(request.headers)
    const locationId = new URL(request.url).searchParams.get('locationId')
    return Response.json({
      report: chatMisses.report(session.user.id, locationId ?? undefined),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    return Response.json(
      { error: 'The chat miss report is not available.' },
      { status: 500 },
    )
  }
}
