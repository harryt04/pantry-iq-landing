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

const previewCsv = vi.fn()
const saveCsvMapping = vi.fn()

class CsvPreviewNotFoundError extends Error {}
class CsvPreviewReadError extends Error {}
vi.mock('@/src/server/csv/previews', () => ({
  previewCsv: (...args: unknown[]) => previewCsv(...args),
  CsvPreviewNotFoundError,
  CsvPreviewReadError,
}))

class CsvMappingNotFoundError extends Error {}
class CsvMappingValidationError extends Error {
  constructor(message = 'Choose a column mapping.') {
    super(message)
  }
}
vi.mock('@/src/server/csv/mapping-persistence', () => ({
  saveCsvMapping: (...args: unknown[]) => saveCsvMapping(...args),
  CsvMappingNotFoundError,
  CsvMappingValidationError,
}))

class ObjectStorageConfigurationError extends Error {}
vi.mock('@/src/server/storage/object-storage', () => ({
  ObjectStorageConfigurationError,
}))

class UnauthorizedError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError: class ForbiddenError extends Error {},
}))

const preview = await import('@/app/api/uploads/[uploadId]/preview/route')
const mapping = await import('@/app/api/uploads/[uploadId]/mapping/route')

const UPLOAD_ID = 'upload-1'

describe('GET /api/uploads/[uploadId]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('returns the preview for an owned upload', async () => {
    previewCsv.mockResolvedValue({ columns: ['Date'], rows: [['2026-08-01']] })
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    const { status, body } = await callRoute(
      preview.GET,
      buildRequest(`/api/uploads/${UPLOAD_ID}/preview`),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(200)
    expect(body).toEqual({ columns: ['Date'], rows: [['2026-08-01']] })
    expect(previewCsv).toHaveBeenCalledWith(headers, UPLOAD_ID)
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['an unknown upload', new CsvPreviewNotFoundError('No such upload.'), 404],
    [
      'unconfigured storage',
      new ObjectStorageConfigurationError('no bucket'),
      503,
    ],
    ['an unreadable object', new CsvPreviewReadError('S3 timeout.'), 503],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    previewCsv.mockRejectedValue(thrown)

    const { status } = await callRoute(
      preview.GET,
      buildRequest(`/api/uploads/${UPLOAD_ID}/preview`),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(expected)
  })
})

describe('PATCH /api/uploads/[uploadId]/mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('saves the mapping and echoes what was stored', async () => {
    saveCsvMapping.mockResolvedValue({
      mappingUsed: { Date: 'transactedAt' },
    })

    const { status, body } = await callRoute(
      mapping.PATCH,
      buildRequest(`/api/uploads/${UPLOAD_ID}/mapping`, {
        method: 'PATCH',
        body: { mapping: { Date: 'transactedAt' } },
      }),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(200)
    expect(body).toEqual({ mapping: { Date: 'transactedAt' } })
  })

  it('accepts an explicit null mapping as a deliberate clear', async () => {
    saveCsvMapping.mockResolvedValue({ mappingUsed: null })

    const { status } = await callRoute(
      mapping.PATCH,
      buildRequest(`/api/uploads/${UPLOAD_ID}/mapping`, {
        method: 'PATCH',
        body: { mapping: null },
      }),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(200)
    expect(saveCsvMapping).toHaveBeenCalledWith(
      expect.anything(),
      UPLOAD_ID,
      null,
    )
  })

  it('rejects a body with no mapping key at all', async () => {
    const { status } = await callRoute(
      mapping.PATCH,
      buildRequest(`/api/uploads/${UPLOAD_ID}/mapping`, {
        method: 'PATCH',
        body: { notMapping: true },
      }),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(400)
    expect(saveCsvMapping).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['an unknown upload', new CsvMappingNotFoundError('No such upload.'), 404],
    ['an invalid mapping', new CsvMappingValidationError('Bad column.'), 400],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    saveCsvMapping.mockRejectedValue(thrown)

    const { status } = await callRoute(
      mapping.PATCH,
      buildRequest(`/api/uploads/${UPLOAD_ID}/mapping`, {
        method: 'PATCH',
        body: { mapping: {} },
      }),
      { uploadId: UPLOAD_ID },
    )

    expect(status).toBe(expected)
  })
})
