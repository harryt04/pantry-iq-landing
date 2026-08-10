/**
 * Harness for testing Next.js route handlers as plain functions.
 *
 * Route handlers in this app are thin: they parse the request, delegate to an
 * owner-scoped service with `await headers()`, and map thrown errors to status
 * codes. That last part is real logic and, before the 2026-08-10 audit, none of
 * it was tested. No server is needed to test it — a handler is just
 * `(Request, context) => Response`.
 *
 * A test file wires up the `next/headers` stub once, at the top:
 *
 * ```ts
 * vi.mock('next/headers', async () => {
 *   const { nextHeadersMock } = await import('../helpers/api-request')
 *   return nextHeadersMock()
 * })
 * ```
 */

/** Headers the mocked `next/headers` returns. Set it per test if it matters. */
export const requestHeaders: { current: Headers } = { current: new Headers() }

export function nextHeadersMock() {
  return { headers: async () => requestHeaders.current }
}

export function setRequestHeaders(init?: HeadersInit) {
  requestHeaders.current = new Headers(init)
  return requestHeaders.current
}

const BASE_URL = 'http://localhost:3000'

export type RequestOptions = {
  method?: string
  body?: unknown
  /** Query string values appended to the path. */
  query?: Record<string, string | undefined>
  headers?: HeadersInit
  /** Sends this exact string as the body, bypassing JSON encoding. */
  rawBody?: string
}

export function buildRequest(path: string, options: RequestOptions = {}) {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }

  const method = options.method ?? 'GET'
  const headers = new Headers(options.headers)
  const hasBody = options.rawBody !== undefined || options.body !== undefined
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return new Request(url, {
    method,
    headers,
    ...(hasBody
      ? { body: options.rawBody ?? JSON.stringify(options.body) }
      : {}),
  })
}

export type RouteResult<T = unknown> = {
  status: number
  body: T
  response: Response
}

/** Reads a handler's Response into a status plus parsed body. */
export async function readResponse<T = unknown>(
  response: Response,
): Promise<RouteResult<T>> {
  const text = await response.text()
  let body: unknown = text
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      // A non-JSON body (a CSV export, for example) stays a string.
    }
  }
  return { status: response.status, body: body as T, response }
}

type RouteHandler<P extends Record<string, string> = Record<string, string>> = (
  request: Request,
  context: { params: Promise<P> },
) => Promise<Response> | Response

type NoArgRouteHandler = () => Promise<Response> | Response

/**
 * Invokes a route handler and reads its response.
 *
 * `params` mirrors what Next.js passes for a dynamic segment, so
 * `callRoute(PATCH, request, { itemId: 'abc' })` matches `[itemId]/route.ts`.
 * The handler's own param type (e.g. `{ uploadId: string }`) is inferred from
 * whichever route function is passed in, so a route.ts signature does not
 * need a manual cast at each call site.
 */
export async function callRoute<
  T = unknown,
  P extends Record<string, string> = Record<string, string>,
>(
  handler: RouteHandler<P> | NoArgRouteHandler,
  request: Request,
  params: P = {} as P,
): Promise<RouteResult<T>> {
  const response = await (handler as RouteHandler<P>)(request, {
    params: Promise.resolve(params),
  })
  return readResponse<T>(response)
}
