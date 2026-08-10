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

const uploadCsv = vi.fn()

class CsvUploadValidationError extends Error {}
class CsvUploadStorageError extends Error {}
vi.mock('@/src/server/csv/uploads', () => ({
  uploadCsv: (...args: unknown[]) => uploadCsv(...args),
  CsvUploadValidationError,
  CsvUploadStorageError,
}))

class CsvSecurityError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}
vi.mock('@/src/server/csv/security', () => ({ CsvSecurityError }))

class ObjectStorageConfigurationError extends Error {}
vi.mock('@/src/server/storage/object-storage', () => ({
  ObjectStorageConfigurationError,
}))

class UnauthorizedError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError: class ForbiddenError extends Error {},
}))

const { POST } = await import('@/app/api/uploads/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'

type UploadPart = 'locationId' | 'filename' | 'importType' | 'body'

/** Builds a complete upload request, minus whichever parts are named. */
function uploadRequest(omit: readonly UploadPart[] = []) {
  setRequestHeaders({
    cookie: 'session=owner',
    ...(omit.includes('filename')
      ? {}
      : { 'x-pantryiq-filename': 'sales.csv' }),
    ...(omit.includes('importType')
      ? {}
      : { 'x-pantryiq-import-type': 'transactions' }),
  })

  return buildRequest('/api/uploads', {
    method: 'POST',
    query: omit.includes('locationId') ? {} : { locationId: LOCATION_ID },
    ...(omit.includes('body')
      ? {}
      : { rawBody: 'date,item\n2026-08-01,salmon\n' }),
  })
}

describe('POST /api/uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams the body to the owner-scoped service and answers 201', async () => {
    uploadCsv.mockResolvedValue({ id: 'upload-1', filename: 'sales.csv' })

    const { status, body } = await callRoute(POST, uploadRequest())

    expect(status).toBe(201)
    expect(body).toEqual({ upload: { id: 'upload-1', filename: 'sales.csv' } })
    expect(uploadCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: LOCATION_ID,
        filename: 'sales.csv',
        importType: 'transactions',
      }),
    )
  })

  it.each([
    ['no locationId', ['locationId']],
    ['no filename header', ['filename']],
    ['no import type header', ['importType']],
    ['no body', ['body']],
  ] as const)(
    'rejects %s with 400 before touching storage',
    async (_label, omit) => {
      const { status, body } = await callRoute(POST, uploadRequest(omit))

      expect(status).toBe(400)
      expect(body).toMatchObject({
        error: 'Choose a location, data type, and CSV file.',
      })
      expect(uploadCsv).not.toHaveBeenCalled()
    },
  )

  it('answers 404 when the location is not the caller own', async () => {
    uploadCsv.mockRejectedValue(
      new CsvSecurityError(
        'That location is not available.',
        'LOCATION_NOT_OWNED',
      ),
    )

    const { status, body } = await callRoute(POST, uploadRequest())

    expect(status).toBe(404)
    expect(body).toMatchObject({ code: 'LOCATION_NOT_OWNED' })
  })

  it('answers 400 for other security refusals', async () => {
    uploadCsv.mockRejectedValue(
      new CsvSecurityError('That file is too large.', 'FILE_TOO_LARGE'),
    )

    const { status, body } = await callRoute(POST, uploadRequest())

    expect(status).toBe(400)
    expect(body).toMatchObject({ code: 'FILE_TOO_LARGE' })
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['invalid upload', new CsvUploadValidationError('Not a CSV.'), 400],
    [
      'unconfigured storage',
      new ObjectStorageConfigurationError('no bucket'),
      503,
    ],
    ['storage outage', new CsvUploadStorageError('S3 unreachable.'), 503],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    uploadCsv.mockRejectedValue(thrown)

    const { status, body } = await callRoute(POST, uploadRequest())

    expect(status).toBe(expected)
    expect(body).toHaveProperty('error')
  })

  it('never leaks an internal message on an unexpected fault', async () => {
    uploadCsv.mockRejectedValue(new Error('AWS_SECRET_ACCESS_KEY is invalid'))

    const { status, body } = await callRoute(POST, uploadRequest())

    expect(status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('AWS_SECRET')
  })
})
