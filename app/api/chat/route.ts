import { getDashboardRecommendations } from '@/src/server/metrics/dashboard-recommendations'
import { loadOwnedContextBundle } from '@/src/server/metrics/context-bundle'
import {
  createNarrationService,
  type ChatTurn,
} from '@/src/server/chat/narration'
import {
  ForbiddenError,
  requireOwnedLocation,
  UnauthorizedError,
} from '@/src/server/auth/authorization'

type ChatRequest = {
  locationId?: unknown
  question?: unknown
  history?: unknown
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as Record<string, unknown>
  return (
    (turn.role === 'user' || turn.role === 'assistant') &&
    typeof turn.content === 'string' &&
    turn.content.length <= 12_000
  )
}

function parseRequest(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    throw new Error('A location and question are required.')
  }
  const body = value as ChatRequest
  if (
    typeof body.locationId !== 'string' ||
    typeof body.question !== 'string' ||
    body.question.trim().length === 0 ||
    body.question.length > 4_000
  ) {
    throw new Error('A location and question are required.')
  }
  const history = Array.isArray(body.history)
    ? body.history.filter(isChatTurn).slice(-12)
    : []
  return {
    locationId: body.locationId,
    question: body.question.trim(),
    history,
  }
}

export async function POST(request: Request) {
  try {
    const { locationId, question, history } = parseRequest(await request.json())
    const owned = await requireOwnedLocation(request.headers, locationId)
    const [contextResult, recommendations] = await Promise.all([
      loadOwnedContextBundle(request.headers, owned.locationId),
      getDashboardRecommendations(request.headers, owned.locationId),
    ])
    if (!contextResult) {
      return Response.json(
        { error: 'There is no completed analysis for this location yet.' },
        { status: 409 },
      )
    }

    const service = createNarrationService()
    const narration = service.stream({
      accountId: owned.session.user.id,
      queryId: crypto.randomUUID(),
      question,
      history,
      contextBundle: contextResult.bundle,
      recommendations,
    })
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of narration.textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          await narration.usage
          controller.close()
        } catch {
          controller.error(new Error('The chat response could not be read.'))
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    return Response.json(
      { error: 'The chat response could not be started.' },
      { status: 500 },
    )
  }
}
