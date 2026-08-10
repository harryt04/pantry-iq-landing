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

const listLocations = vi.fn()
const createLocation = vi.fn()
const updateLocation = vi.fn()
const deleteLocation = vi.fn()
const getLocationDeletionSummary = vi.fn()

class LocationNotFoundError extends Error {}
vi.mock('@/src/server/locations/locations', () => ({
  listLocations: (...args: unknown[]) => listLocations(...args),
  createLocation: (...args: unknown[]) => createLocation(...args),
  updateLocation: (...args: unknown[]) => updateLocation(...args),
  deleteLocation: (...args: unknown[]) => deleteLocation(...args),
  getLocationDeletionSummary: (...args: unknown[]) =>
    getLocationDeletionSummary(...args),
  LocationNotFoundError,
}))

class LocationValidationError extends Error {}
vi.mock('@/src/server/locations/location-input', () => ({
  LocationValidationError,
}))

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
}))

const collection = await import('@/app/api/locations/route')
const single = await import('@/app/api/locations/[locationId]/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'

describe('/api/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  describe('GET (collection)', () => {
    it('returns only what the owner-scoped service hands back', async () => {
      listLocations.mockResolvedValue([{ id: LOCATION_ID, name: 'North' }])

      const { status, body } = await callRoute(
        collection.GET,
        buildRequest('/api/locations'),
      )

      expect(status).toBe(200)
      expect(body).toEqual({ locations: [{ id: LOCATION_ID, name: 'North' }] })
    })

    it('scopes the read to the caller session', async () => {
      listLocations.mockResolvedValue([])
      const headers = setRequestHeaders({ cookie: 'session=owner' })

      await callRoute(collection.GET, buildRequest('/api/locations'))

      expect(listLocations).toHaveBeenCalledWith(headers)
    })

    it.each([
      ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
      ['unexpected fault', new Error('connection reset'), 500],
    ])('maps %s to %i', async (_label, thrown, expected) => {
      listLocations.mockRejectedValue(thrown)

      const { status } = await callRoute(
        collection.GET,
        buildRequest('/api/locations'),
      )

      expect(status).toBe(expected)
    })
  })

  describe('POST (create)', () => {
    it('creates and answers 201', async () => {
      createLocation.mockResolvedValue({ id: LOCATION_ID, name: 'North' })

      const { status, body } = await callRoute(
        collection.POST,
        buildRequest('/api/locations', {
          method: 'POST',
          body: { name: 'North' },
        }),
      )

      expect(status).toBe(201)
      expect(body).toEqual({ location: { id: LOCATION_ID, name: 'North' } })
    })

    it.each([
      ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
      ['invalid input', new LocationValidationError('Name is required.'), 400],
      ['unexpected fault', new Error('connection reset'), 500],
    ])('maps %s to %i', async (_label, thrown, expected) => {
      createLocation.mockRejectedValue(thrown)

      const { status, body } = await callRoute(
        collection.POST,
        buildRequest('/api/locations', { method: 'POST', body: {} }),
      )

      expect(status).toBe(expected)
      expect(body).toHaveProperty('error')
    })
  })

  describe('PATCH (update)', () => {
    it('updates the location named in the path', async () => {
      updateLocation.mockResolvedValue({ id: LOCATION_ID, name: 'South' })
      const headers = setRequestHeaders({ cookie: 'session=owner' })

      const { status, body } = await callRoute(
        single.PATCH,
        buildRequest(`/api/locations/${LOCATION_ID}`, {
          method: 'PATCH',
          body: { name: 'South' },
        }),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(200)
      expect(body).toEqual({ location: { id: LOCATION_ID, name: 'South' } })
      expect(updateLocation).toHaveBeenCalledWith(headers, LOCATION_ID, {
        name: 'South',
      })
    })

    it.each([
      ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
      ['another account', new ForbiddenError('Not available.'), 404],
      ['a missing location', new LocationNotFoundError('Gone.'), 404],
      ['invalid input', new LocationValidationError('Name is required.'), 400],
      ['unexpected fault', new Error('connection reset'), 500],
    ])('maps %s to %i', async (_label, thrown, expected) => {
      updateLocation.mockRejectedValue(thrown)

      const { status } = await callRoute(
        single.PATCH,
        buildRequest(`/api/locations/${LOCATION_ID}`, {
          method: 'PATCH',
          body: {},
        }),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(expected)
    })

    it('hides another account behind the same 404 as a missing location', async () => {
      updateLocation.mockRejectedValue(new ForbiddenError('Not available.'))
      const forbidden = await callRoute(
        single.PATCH,
        buildRequest(`/api/locations/${LOCATION_ID}`, {
          method: 'PATCH',
          body: {},
        }),
        { locationId: LOCATION_ID },
      )

      updateLocation.mockRejectedValue(new LocationNotFoundError('Gone.'))
      const missing = await callRoute(
        single.PATCH,
        buildRequest(`/api/locations/${LOCATION_ID}`, {
          method: 'PATCH',
          body: {},
        }),
        { locationId: LOCATION_ID },
      )

      // An attacker must not learn that a location exists but belongs to
      // someone else, so both cases answer with the same status.
      expect(forbidden.status).toBe(missing.status)
      expect(forbidden.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('answers 204 with no body', async () => {
      deleteLocation.mockResolvedValue(undefined)

      const { status, body } = await callRoute(
        single.DELETE,
        buildRequest(`/api/locations/${LOCATION_ID}`, { method: 'DELETE' }),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(204)
      expect(body).toBe('')
    })

    it.each([
      ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
      ['another account', new ForbiddenError('Not available.'), 404],
      ['unexpected fault', new Error('connection reset'), 500],
    ])('maps %s to %i', async (_label, thrown, expected) => {
      deleteLocation.mockRejectedValue(thrown)

      const { status } = await callRoute(
        single.DELETE,
        buildRequest(`/api/locations/${LOCATION_ID}`, { method: 'DELETE' }),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(expected)
    })
  })

  describe('GET (deletion summary)', () => {
    it('returns the summary for the owner', async () => {
      getLocationDeletionSummary.mockResolvedValue({ transactions: 40 })

      const { status, body } = await callRoute(
        single.GET,
        buildRequest(`/api/locations/${LOCATION_ID}`),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(200)
      expect(body).toEqual({ summary: { transactions: 40 } })
    })

    it('refuses another account with 404', async () => {
      getLocationDeletionSummary.mockRejectedValue(
        new ForbiddenError('Not available.'),
      )

      const { status } = await callRoute(
        single.GET,
        buildRequest(`/api/locations/${LOCATION_ID}`),
        { locationId: LOCATION_ID },
      )

      expect(status).toBe(404)
    })
  })
})
