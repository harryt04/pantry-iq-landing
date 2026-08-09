import { getDashboardRecommendations } from '@/src/server/metrics/dashboard-recommendations'
import { loadOwnedContextBundle } from '@/src/server/metrics/context-bundle'
import {
  applyAssumptionOverride,
  parseAssumptionOverride,
} from '@/src/server/chat/assumption-override'
import {
  buildPrecomputeResults,
  loadPrecomputeInput,
} from '@/src/server/metrics/precompute'
import {
  createNarrationService,
  type ChatTurn,
  type NarrationRecommendation,
} from '@/src/server/chat/narration'
import { CHAT_HISTORY_MAX_MESSAGES } from '@/src/chat/session-memory'
import {
  ForbiddenError,
  requireSession,
  requireOwnedLocation,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { getPortfolioChatData } from '@/src/server/metrics/portfolio'

type ChatRequest = {
  locationId?: unknown
  scope?: unknown
  question?: unknown
  history?: unknown
  overrides?: unknown
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
  const scope: 'portfolio' | 'location' =
    body.scope === 'portfolio' ? 'portfolio' : 'location'
  if (
    (scope === 'location' && typeof body.locationId !== 'string') ||
    typeof body.question !== 'string' ||
    body.question.trim().length === 0 ||
    body.question.length > 4_000
  ) {
    throw new Error('A location and question are required.')
  }
  const history = Array.isArray(body.history)
    ? body.history.filter(isChatTurn).slice(-CHAT_HISTORY_MAX_MESSAGES)
    : []
  const overrides = Array.isArray(body.overrides)
    ? body.overrides.slice(-5).map(parseAssumptionOverride)
    : []
  return {
    locationId: typeof body.locationId === 'string' ? body.locationId : null,
    scope,
    question: body.question.trim(),
    history,
    overrides,
  }
}

export async function POST(request: Request) {
  try {
    const { locationId, question, history, overrides, scope } = parseRequest(
      await request.json(),
    )
    let accountId: string
    let narrationLocationId: string
    let contextBundle:
      | NonNullable<
          Awaited<ReturnType<typeof loadOwnedContextBundle>>
        >['bundle']
      | NonNullable<
          Awaited<ReturnType<typeof getPortfolioChatData>>
        >['contextBundle']
      | null
    let baseRecommendations: readonly NarrationRecommendation[]
    let requiredLocationNames: readonly string[] = []

    if (scope === 'portfolio') {
      const session = await requireSession(request.headers)
      const portfolio = await getPortfolioChatData(request.headers)
      accountId = session.user.id
      narrationLocationId = 'portfolio'
      contextBundle = portfolio?.contextBundle ?? null
      baseRecommendations = portfolio?.recommendations ?? []
      requiredLocationNames = portfolio?.locationNames ?? []
    } else {
      const owned = await requireOwnedLocation(request.headers, locationId!)
      accountId = owned.session.user.id
      narrationLocationId = owned.locationId
      const loaded = await Promise.all([
        loadOwnedContextBundle(request.headers, owned.locationId),
        getDashboardRecommendations(request.headers, owned.locationId),
      ])
      contextBundle = loaded[0]?.bundle ?? null
      baseRecommendations = loaded[1]
    }
    if (!contextBundle) {
      return Response.json(
        { error: 'There is no completed analysis for this location yet.' },
        { status: 409 },
      )
    }

    let recommendations = baseRecommendations
    if (overrides.length > 0) {
      if (scope === 'portfolio') {
        return Response.json(
          { error: 'Assumption questions are available for one location.' },
          { status: 400 },
        )
      }
      let input = await loadPrecomputeInput(narrationLocationId)
      for (const override of overrides) {
        input = applyAssumptionOverride(input, override)
      }
      recommendations = buildPrecomputeResults(
        input,
        new Date(),
      ).recommendations
    }

    const service = createNarrationService()
    const narration = service.stream({
      accountId,
      locationId: narrationLocationId,
      queryId: crypto.randomUUID(),
      question,
      history,
      contextBundle,
      recommendations,
      scope,
      requiredLocationNames,
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
