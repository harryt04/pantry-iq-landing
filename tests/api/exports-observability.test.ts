import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildRequest,
  callRoute,
  setRequestHeaders,
} from '../helpers/api-request'

vi.mock('next/headers', async () => {
  const { nextHeadersMock } = await import('../helpers/api-request')
  return nextHeadersMock()
})

const exportLocationCsv = vi.fn()
const requireOwnedLocation = vi.fn()
const requireSession = vi.fn()
const listLocations = vi.fn()
const getPrecomputeHealth = vi.fn()
const getImportHealth = vi.fn()
const listDailyLlmSpend = vi.fn()

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
  requireOwnedLocation: (...args: unknown[]) => requireOwnedLocation(...args),
  requireSession: (...args: unknown[]) => requireSession(...args),
}))

vi.mock('@/src/server/csv/exports', () => ({
  exportLocationCsv: (...args: unknown[]) => exportLocationCsv(...args),
  isCsvExportType: (value: string) =>
    ['items', 'transactions', 'recommendations'].includes(value),
}))

vi.mock('@/src/server/locations/locations', () => ({
  listLocations: (...args: unknown[]) => listLocations(...args),
}))

vi.mock('@/src/server/observability/store', () => ({
  getPrecomputeHealth: (...args: unknown[]) => getPrecomputeHealth(...args),
  getImportHealth: (...args: unknown[]) => getImportHealth(...args),
  listDailyLlmSpend: (...args: unknown[]) => listDailyLlmSpend(...args),
}))

const exports = await import('@/app/api/exports/[exportType]/route')
const observability = await import('@/app/api/observability/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000b002'

describe('GET /api/exports/[exportType]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('returns CSV as an attachment that caches nowhere', async () => {
    exportLocationCsv.mockResolvedValue('name,cost\nSalmon,9.50\n')

    const { status, body, response } = await callRoute(
      exports.GET,
      buildRequest('/api/exports/items', {
        query: { locationId: LOCATION_ID },
      }),
      { exportType: 'items' },
    )

    expect(status).toBe(200)
    expect(body).toBe('name,cost\nSalmon,9.50\n')
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="pantryiq-items.csv"',
    )
    // Exported rows are the customer's own business data. A shared cache must
    // never hold on to them.
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each([
    ['no location', {}, 'items'],
    ['an unknown export type', { locationId: LOCATION_ID }, 'everything'],
  ])('rejects %s with 400', async (_label, query, exportType) => {
    const { status } = await callRoute(
      exports.GET,
      buildRequest(`/api/exports/${exportType}`, { query }),
      { exportType },
    )

    expect(status).toBe(400)
    expect(exportLocationCsv).not.toHaveBeenCalled()
  })

  it('refuses another account with 404 and no CSV body', async () => {
    exportLocationCsv.mockRejectedValue(new ForbiddenError('Not available.'))

    const { status, response } = await callRoute(
      exports.GET,
      buildRequest('/api/exports/items', {
        query: { locationId: OTHER_LOCATION_ID },
      }),
      { exportType: 'items' },
    )

    expect(status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    exportLocationCsv.mockRejectedValue(thrown)

    const { status } = await callRoute(
      exports.GET,
      buildRequest('/api/exports/items', {
        query: { locationId: LOCATION_ID },
      }),
      { exportType: 'items' },
    )

    expect(status).toBe(expected)
  })
})

describe('GET /api/observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSession.mockResolvedValue({ user: { id: 'owner-1' } })
    getPrecomputeHealth.mockResolvedValue({ lastRun: null })
    getImportHealth.mockResolvedValue({ lastImport: null })
    listDailyLlmSpend.mockResolvedValue([])
  })

  it('reports health for every location the caller owns', async () => {
    listLocations.mockResolvedValue([
      { id: LOCATION_ID, name: 'North' },
      { id: 'loc-2', name: 'South' },
    ])

    const { status, body } = await callRoute(
      observability.GET,
      buildRequest('/api/observability'),
    )

    expect(status).toBe(200)
    expect(body).toMatchObject({
      locations: [
        { id: LOCATION_ID, name: 'North' },
        { id: 'loc-2', name: 'South' },
      ],
    })
    expect(listDailyLlmSpend).toHaveBeenCalledWith('owner-1')
  })

  it('narrows to one location when asked, through the ownership guard', async () => {
    requireOwnedLocation.mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      locationId: LOCATION_ID,
    })

    const { status, body } = await callRoute(
      observability.GET,
      buildRequest('/api/observability', {
        query: { locationId: LOCATION_ID },
      }),
    )

    expect(status).toBe(200)
    expect(body).toMatchObject({ locations: [{ id: LOCATION_ID }] })
    expect(listLocations).not.toHaveBeenCalled()
  })

  it('scopes LLM spend to the caller, never the whole install', async () => {
    listLocations.mockResolvedValue([])

    await callRoute(observability.GET, buildRequest('/api/observability'))

    expect(listDailyLlmSpend).toHaveBeenCalledWith('owner-1')
    expect(listDailyLlmSpend).not.toHaveBeenCalledWith(undefined)
  })

  it('answers 401 rather than 500 when the caller has no session', async () => {
    requireSession.mockRejectedValue(new UnauthorizedError('Sign in first.'))

    const { status, body } = await callRoute(
      observability.GET,
      buildRequest('/api/observability'),
    )

    expect(status).toBe(401)
    expect(body).toHaveProperty('error')
  })

  it('answers 404 rather than 500 for another account location', async () => {
    requireOwnedLocation.mockRejectedValue(new ForbiddenError('Not available.'))

    const { status } = await callRoute(
      observability.GET,
      buildRequest('/api/observability', {
        query: { locationId: OTHER_LOCATION_ID },
      }),
    )

    expect(status).toBe(404)
    expect(getPrecomputeHealth).not.toHaveBeenCalled()
  })
})
