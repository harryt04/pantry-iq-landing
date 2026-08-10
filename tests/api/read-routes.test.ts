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

const listInventoryItems = vi.fn()
const listImportHistory = vi.fn()
const listConnectorConnectionStatuses = vi.fn()
const requireOwnedLocation = vi.fn()
const requireSession = vi.fn()
const report = vi.fn()

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
  requireOwnedLocation: (...args: unknown[]) => requireOwnedLocation(...args),
  requireSession: (...args: unknown[]) => requireSession(...args),
}))

vi.mock('@/src/server/inventory/items', () => ({
  listInventoryItems: (...args: unknown[]) => listInventoryItems(...args),
  InventoryItemNotFoundError: class InventoryItemNotFoundError extends Error {},
  updateInventoryItem: vi.fn(),
}))

vi.mock('@/src/server/inventory/item-input', () => ({
  InventoryItemValidationError: class InventoryItemValidationError extends Error {},
}))

vi.mock('@/src/server/csv/imports', () => ({
  listImportHistory: (...args: unknown[]) => listImportHistory(...args),
}))

vi.mock('@/src/server/connectors/framework', () => ({
  listConnectorConnectionStatuses: (...args: unknown[]) =>
    listConnectorConnectionStatuses(...args),
}))

vi.mock('@/src/server/chat/misses', () => ({
  chatMisses: { report: (...args: unknown[]) => report(...args) },
}))

const items = await import('@/app/api/items/route')
const history = await import('@/app/api/uploads/history/route')
const connectors = await import('@/app/api/connectors/status/route')
const misses = await import('@/app/api/chat/misses/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000b002'

describe('GET /api/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('returns a trimmed public shape, not the raw row', async () => {
    listInventoryItems.mockResolvedValue([
      {
        id: 'item-1',
        canonicalName: 'salmon',
        displayName: 'Salmon',
        category: 'seafood',
        unit: 'lb',
        itemType: 'ingredient',
        shelfLifeDays: 3,
        costPerUnit: '9.50',
        usageCount: 12,
        isActive: true,
        updatedAt: '2026-08-08T00:00:00.000Z',
        // Fields the client has no business seeing must not survive the map.
        internalNotes: 'supplier margin 40%',
        userId: 'owner-1',
      },
    ])

    const { status, body } = await callRoute(
      items.GET,
      buildRequest('/api/items', { query: { locationId: LOCATION_ID } }),
    )

    expect(status).toBe(200)
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('internalNotes')
    expect(serialized).not.toContain('userId')
    expect(body).toMatchObject({
      items: [expect.objectContaining({ id: 'item-1', displayName: 'Salmon' })],
    })
  })

  it('scopes the read to the caller session and the requested location', async () => {
    listInventoryItems.mockResolvedValue([])
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    await callRoute(
      items.GET,
      buildRequest('/api/items', { query: { locationId: LOCATION_ID } }),
    )

    expect(listInventoryItems).toHaveBeenCalledWith(headers, LOCATION_ID, {
      includeInactive: true,
    })
  })

  it('requires a location', async () => {
    const { status } = await callRoute(items.GET, buildRequest('/api/items'))

    expect(status).toBe(400)
    expect(listInventoryItems).not.toHaveBeenCalled()
  })

  it('publishes the effective shelf life next to where it came from', async () => {
    // Without the source, the UI cannot tell a value the user set apart from a
    // category default, and a guess gets presented as a fact.
    listInventoryItems.mockResolvedValue([
      {
        id: 'item-1',
        canonicalName: 'salmon',
        displayName: 'Salmon',
        category: 'Seafood',
        unit: 'lb',
        itemType: 'ingredient',
        shelfLifeDays: null,
        costPerUnit: '9.50',
        usageCount: 3,
        isActive: true,
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
    ])

    const { body } = await callRoute<{
      items: Array<Record<string, unknown>>
    }>(
      items.GET,
      buildRequest('/api/items', { query: { locationId: LOCATION_ID } }),
    )

    const [item] = body.items
    expect(item).toHaveProperty('effectiveShelfLifeDays')
    expect(item).toHaveProperty('shelfLifeSource')
    expect(item).toHaveProperty('shelfLifeSuggestionCategory')
    // No item-level value was set, so the effective value cannot claim to be one.
    expect(item?.shelfLifeDays).toBeNull()
    expect(item?.shelfLifeSource).not.toBe('user')
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 404],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    listInventoryItems.mockRejectedValue(thrown)

    const { status } = await callRoute(
      items.GET,
      buildRequest('/api/items', { query: { locationId: OTHER_LOCATION_ID } }),
    )

    expect(status).toBe(expected)
  })
})

describe('GET /api/uploads/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('returns history for an owned location', async () => {
    listImportHistory.mockResolvedValue([{ id: 'import-1' }])
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    const { status, body } = await callRoute(
      history.GET,
      buildRequest('/api/uploads/history', {
        query: { locationId: LOCATION_ID },
      }),
    )

    expect(status).toBe(200)
    expect(body).toEqual({ history: [{ id: 'import-1' }] })
    expect(listImportHistory).toHaveBeenCalledWith(headers, LOCATION_ID)
  })

  it('requires a location', async () => {
    const { status } = await callRoute(
      history.GET,
      buildRequest('/api/uploads/history'),
    )

    expect(status).toBe(400)
    expect(listImportHistory).not.toHaveBeenCalled()
  })

  it('hides another account behind 404 rather than 403', async () => {
    listImportHistory.mockRejectedValue(new ForbiddenError('Not available.'))

    const { status } = await callRoute(
      history.GET,
      buildRequest('/api/uploads/history', {
        query: { locationId: OTHER_LOCATION_ID },
      }),
    )

    expect(status).toBe(404)
  })

  it('maps an unauthenticated caller to 401', async () => {
    listImportHistory.mockRejectedValue(new UnauthorizedError('Sign in first.'))

    const { status } = await callRoute(
      history.GET,
      buildRequest('/api/uploads/history', {
        query: { locationId: LOCATION_ID },
      }),
    )

    expect(status).toBe(401)
  })
})

describe('GET /api/connectors/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('passes the location through when one is given', async () => {
    listConnectorConnectionStatuses.mockResolvedValue([{ id: 'square' }])
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    const { status, body } = await callRoute(
      connectors.GET,
      buildRequest('/api/connectors/status', {
        query: { locationId: LOCATION_ID },
      }),
    )

    expect(status).toBe(200)
    expect(body).toEqual({ connections: [{ id: 'square' }] })
    expect(listConnectorConnectionStatuses).toHaveBeenCalledWith({
      headers,
      locationId: LOCATION_ID,
    })
  })

  it('omits the location key entirely when none is given', async () => {
    listConnectorConnectionStatuses.mockResolvedValue([])

    await callRoute(connectors.GET, buildRequest('/api/connectors/status'))

    const [call] = listConnectorConnectionStatuses.mock.calls
    expect(call?.[0]).not.toHaveProperty('locationId')
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 403],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    listConnectorConnectionStatuses.mockRejectedValue(thrown)

    const { status } = await callRoute(
      connectors.GET,
      buildRequest('/api/connectors/status'),
    )

    expect(status).toBe(expected)
  })
})

describe('GET /api/chat/misses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    report.mockReturnValue({ total: 0, entries: [] })
  })

  it('scopes the report to the owned location when one is given', async () => {
    requireOwnedLocation.mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      locationId: LOCATION_ID,
    })

    const { status } = await callRoute(
      misses.GET,
      buildRequest('/api/chat/misses', { query: { locationId: LOCATION_ID } }),
    )

    expect(status).toBe(200)
    expect(report).toHaveBeenCalledWith('owner-1', LOCATION_ID)
    expect(requireSession).not.toHaveBeenCalled()
  })

  it('falls back to a session-wide report with no location', async () => {
    requireSession.mockResolvedValue({ user: { id: 'owner-1' } })

    const { status } = await callRoute(
      misses.GET,
      buildRequest('/api/chat/misses'),
    )

    expect(status).toBe(200)
    expect(report).toHaveBeenCalledWith('owner-1', undefined)
    expect(requireOwnedLocation).not.toHaveBeenCalled()
  })

  it('never reports on a location the caller does not own', async () => {
    requireOwnedLocation.mockRejectedValue(new ForbiddenError('Not available.'))

    const { status } = await callRoute(
      misses.GET,
      buildRequest('/api/chat/misses', {
        query: { locationId: OTHER_LOCATION_ID },
      }),
    )

    expect(status).toBe(404)
    expect(report).not.toHaveBeenCalled()
  })

  it('maps an unauthenticated caller to 401', async () => {
    requireSession.mockRejectedValue(new UnauthorizedError('Sign in first.'))

    const { status } = await callRoute(
      misses.GET,
      buildRequest('/api/chat/misses'),
    )

    expect(status).toBe(401)
    expect(report).not.toHaveBeenCalled()
  })

  it('reads the session from the request headers, not ambient state', async () => {
    requireSession.mockResolvedValue({ user: { id: 'owner-1' } })
    const request = buildRequest('/api/chat/misses', {
      headers: { cookie: 'session=from-request' },
    })

    await callRoute(misses.GET, request)

    expect(requireSession).toHaveBeenCalledWith(request.headers)
  })
})
