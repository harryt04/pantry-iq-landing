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

const createManualEntry = vi.fn()

class ManualEntryValidationError extends Error {}
vi.mock('@/src/server/manual/manual-entry', () => ({
  createManualEntry: (...args: unknown[]) => createManualEntry(...args),
  ManualEntryValidationError,
}))

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
}))

const { POST } = await import('@/app/api/manual-entry/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'

function entryRequest(
  body: unknown = { entryType: 'waste' },
  locationId = LOCATION_ID,
) {
  return buildRequest('/api/manual-entry', {
    method: 'POST',
    body,
    ...(locationId ? { query: { locationId } } : {}),
  })
}

describe('POST /api/manual-entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('creates the entry and answers 201', async () => {
    createManualEntry.mockResolvedValue({ id: 'entry-1', rowsWritten: 1 })

    const { status, body } = await callRoute(POST, entryRequest())

    expect(status).toBe(201)
    expect(body).toEqual({ result: { id: 'entry-1', rowsWritten: 1 } })
  })

  it('passes the session headers and location to the owner-scoped service', async () => {
    createManualEntry.mockResolvedValue({ id: 'entry-1' })
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    await callRoute(POST, entryRequest({ entryType: 'labor', hours: 8 }))

    expect(createManualEntry).toHaveBeenCalledWith(headers, LOCATION_ID, {
      entryType: 'labor',
      hours: 8,
    })
  })

  it('requires locationId before it writes anything', async () => {
    const { status, body } = await callRoute(POST, entryRequest({}, ''))

    expect(status).toBe(400)
    expect(body).toMatchObject({ error: 'locationId is required.' })
    expect(createManualEntry).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 404],
    [
      'invalid input',
      new ManualEntryValidationError('Quantity must be positive.'),
      400,
    ],
    ['unexpected fault', new Error('deadlock detected'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    createManualEntry.mockRejectedValue(thrown)

    const { status, body } = await callRoute(POST, entryRequest())

    expect(status).toBe(expected)
    expect(body).toHaveProperty('error')
  })

  it('promises nothing was changed when the write fails', async () => {
    createManualEntry.mockRejectedValue(new Error('deadlock detected'))

    const { body } = await callRoute(POST, entryRequest())

    expect(body).toMatchObject({
      error: 'The manual entry could not be saved. Nothing was changed.',
    })
  })
})
