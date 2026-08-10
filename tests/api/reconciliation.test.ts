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

const requireOwnedLocation = vi.fn()
const refreshLocationReconciliation = vi.fn()
const resolveReconciliationConflict = vi.fn()
const enqueuePrecomputeForLocation = vi.fn()

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
  requireOwnedLocation: (...args: unknown[]) => requireOwnedLocation(...args),
}))

vi.mock('@/src/server/ingestion/reconciliation', () => ({
  refreshLocationReconciliation: (...args: unknown[]) =>
    refreshLocationReconciliation(...args),
  resolveReconciliationConflict: (...args: unknown[]) =>
    resolveReconciliationConflict(...args),
}))

vi.mock('@/src/server/metrics/scheduler', () => ({
  enqueuePrecomputeForLocation: (...args: unknown[]) =>
    enqueuePrecomputeForLocation(...args),
}))

const { GET, POST } = await import('@/app/api/reconciliation/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'

describe('/api/reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
    requireOwnedLocation.mockResolvedValue({
      session: { user: { id: 'owner' } },
      locationId: LOCATION_ID,
    })
  })

  describe('GET', () => {
    it('returns conflicts for an owned location', async () => {
      refreshLocationReconciliation.mockResolvedValue([{ id: 'conflict-1' }])

      const { status, body } = await callRoute(
        GET,
        buildRequest('/api/reconciliation', {
          query: { locationId: LOCATION_ID },
        }),
      )

      expect(status).toBe(200)
      expect(body).toEqual({ conflicts: [{ id: 'conflict-1' }] })
    })

    it('requires a location before it reads anything', async () => {
      const { status, body } = await callRoute(
        GET,
        buildRequest('/api/reconciliation'),
      )

      expect(status).toBe(400)
      expect(body).toMatchObject({ error: 'Choose a location.' })
      expect(refreshLocationReconciliation).not.toHaveBeenCalled()
    })

    it('checks ownership before it reads the location data', async () => {
      // refreshLocationReconciliation takes a bare locationId and does no
      // ownership check of its own, so the guard must run first or the route
      // leaks another account's conflicts.
      const order: string[] = []
      requireOwnedLocation.mockImplementation(async () => {
        order.push('guard')
        return { session: { user: { id: 'owner' } }, locationId: LOCATION_ID }
      })
      refreshLocationReconciliation.mockImplementation(async () => {
        order.push('read')
        return []
      })

      await callRoute(
        GET,
        buildRequest('/api/reconciliation', {
          query: { locationId: LOCATION_ID },
        }),
      )

      expect(order).toEqual(['guard', 'read'])
    })

    it('does not read the data when the guard refuses', async () => {
      requireOwnedLocation.mockRejectedValue(
        new ForbiddenError('Not available.'),
      )

      const { status } = await callRoute(
        GET,
        buildRequest('/api/reconciliation', {
          query: { locationId: LOCATION_ID },
        }),
      )

      expect(status).toBe(403)
      expect(refreshLocationReconciliation).not.toHaveBeenCalled()
    })

    it.each([
      ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
      ['another account', new ForbiddenError('Not available.'), 403],
      ['unexpected fault', new Error('connection reset'), 404],
    ])('maps %s to %i', async (_label, thrown, expected) => {
      requireOwnedLocation.mockRejectedValue(thrown)

      const { status } = await callRoute(
        GET,
        buildRequest('/api/reconciliation', {
          query: { locationId: LOCATION_ID },
        }),
      )

      expect(status).toBe(expected)
    })
  })

  describe('POST', () => {
    const body = {
      locationId: LOCATION_ID,
      conflictId: 'conflict-1',
      authoritySource: 'square',
    }

    it('resolves the conflict and requeues the metrics', async () => {
      resolveReconciliationConflict.mockResolvedValue({ id: 'conflict-1' })
      enqueuePrecomputeForLocation.mockResolvedValue(undefined)

      const { status, body: responseBody } = await callRoute(
        POST,
        buildRequest('/api/reconciliation', { method: 'POST', body }),
      )

      expect(status).toBe(200)
      expect(responseBody).toEqual({ conflict: { id: 'conflict-1' } })
      expect(enqueuePrecomputeForLocation).toHaveBeenCalledWith(LOCATION_ID)
    })

    it.each([
      ['no locationId', { ...body, locationId: undefined }],
      ['no conflictId', { ...body, conflictId: undefined }],
      ['no authoritySource', { ...body, authoritySource: undefined }],
    ])('rejects %s with 400', async (_label, incomplete) => {
      const { status } = await callRoute(
        POST,
        buildRequest('/api/reconciliation', {
          method: 'POST',
          body: incomplete,
        }),
      )

      expect(status).toBe(400)
      expect(resolveReconciliationConflict).not.toHaveBeenCalled()
    })

    it('checks ownership before it writes', async () => {
      requireOwnedLocation.mockRejectedValue(
        new ForbiddenError('Not available.'),
      )

      const { status } = await callRoute(
        POST,
        buildRequest('/api/reconciliation', { method: 'POST', body }),
      )

      expect(status).toBe(403)
      expect(resolveReconciliationConflict).not.toHaveBeenCalled()
    })

    it('answers 404 when the conflict is already gone', async () => {
      resolveReconciliationConflict.mockResolvedValue(null)

      const { status, body: responseBody } = await callRoute(
        POST,
        buildRequest('/api/reconciliation', { method: 'POST', body }),
      )

      expect(status).toBe(404)
      expect(responseBody).toMatchObject({
        error: 'That overlap is no longer available.',
      })
      expect(enqueuePrecomputeForLocation).not.toHaveBeenCalled()
    })

    it('still answers success when requeueing the metrics fails', async () => {
      // The conflict is already resolved and committed at this point. A queue
      // outage must not report the write as failed.
      resolveReconciliationConflict.mockResolvedValue({ id: 'conflict-1' })
      enqueuePrecomputeForLocation.mockRejectedValue(new Error('queue down'))

      const { status } = await callRoute(
        POST,
        buildRequest('/api/reconciliation', { method: 'POST', body }),
      )

      expect(status).toBe(200)
    })
  })
})
