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

const previewCsvImport = vi.fn()
const commitCsvImport = vi.fn()

class CsvImportNotFoundError extends Error {}
class CsvImportUnresolvedError extends Error {
  plan: {
    rows: unknown[]
    newItems: unknown[]
    linkedItemCount: number
    unmatchedItems: unknown[]
    items: unknown[]
  }
  constructor(plan: CsvImportUnresolvedError['plan']) {
    super('Some items still need your call.')
    this.plan = plan
  }
}

vi.mock('@/src/server/csv/imports', () => ({
  previewCsvImport: (...args: unknown[]) => previewCsvImport(...args),
  commitCsvImport: (...args: unknown[]) => commitCsvImport(...args),
  CsvImportNotFoundError,
  CsvImportUnresolvedError,
}))

class CsvImportValidationError extends Error {}
vi.mock('@/src/server/csv/import-plan', () => ({ CsvImportValidationError }))

class ObjectStorageConfigurationError extends Error {}
vi.mock('@/src/server/storage/object-storage', () => ({
  ObjectStorageConfigurationError,
}))

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
}))

const { POST } = await import('@/app/api/uploads/[uploadId]/commit/route')

const UPLOAD_ID = 'upload-1'

function commitRequest(body: unknown = {}) {
  return buildRequest(`/api/uploads/${UPLOAD_ID}/commit`, {
    method: 'POST',
    body,
  })
}

describe('POST /api/uploads/[uploadId]/commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('commits by default and returns the summary', async () => {
    commitCsvImport.mockResolvedValue({ rowsImported: 12, ready: true })

    const { status, body } = await callRoute(POST, commitRequest(), {
      uploadId: UPLOAD_ID,
    })

    expect(status).toBe(200)
    expect(body).toEqual({ summary: { rowsImported: 12, ready: true } })
    expect(commitCsvImport).toHaveBeenCalledOnce()
    expect(previewCsvImport).not.toHaveBeenCalled()
  })

  it('previews without committing when dryRun is set', async () => {
    previewCsvImport.mockResolvedValue({ rowsToImport: 3, ready: true })

    const { status, body } = await callRoute(
      POST,
      commitRequest({ dryRun: true }),
      {
        uploadId: UPLOAD_ID,
      },
    )

    expect(status).toBe(200)
    expect(body).toEqual({ summary: { rowsToImport: 3, ready: true } })
    expect(previewCsvImport).toHaveBeenCalledOnce()
    expect(commitCsvImport).not.toHaveBeenCalled()
  })

  it('passes the caller headers and upload id to the owner-scoped service', async () => {
    commitCsvImport.mockResolvedValue({ rowsImported: 1 })
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    await callRoute(
      POST,
      commitRequest({ resolutions: { salmon: 'item-1' } }),
      {
        uploadId: UPLOAD_ID,
      },
    )

    expect(commitCsvImport).toHaveBeenCalledWith(headers, UPLOAD_ID, {
      salmon: 'item-1',
    })
  })

  it('tolerates a malformed body rather than failing with a parse error', async () => {
    commitCsvImport.mockResolvedValue({ rowsImported: 0 })

    const request = buildRequest(`/api/uploads/${UPLOAD_ID}/commit`, {
      method: 'POST',
      rawBody: 'not json',
    })
    const { status } = await callRoute(POST, request, { uploadId: UPLOAD_ID })

    expect(status).toBe(200)
    expect(commitCsvImport).toHaveBeenCalledWith(
      expect.anything(),
      UPLOAD_ID,
      undefined,
    )
  })

  it.each([
    ['an unauthenticated caller', new UnauthorizedError('Sign in first.'), 401],
    ['an unknown upload', new CsvImportNotFoundError('No such upload.'), 404],
    [
      'an invalid plan',
      new CsvImportValidationError('Row 3 has no date.'),
      400,
    ],
    [
      'unconfigured storage',
      new ObjectStorageConfigurationError('no bucket'),
      503,
    ],
    ['an unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    commitCsvImport.mockRejectedValue(thrown)

    const { status, body } = await callRoute(POST, commitRequest(), {
      uploadId: UPLOAD_ID,
    })

    expect(status).toBe(expected)
    expect(body).toHaveProperty('error')
  })

  it('returns 409 with the unresolved summary so the client can prompt', async () => {
    commitCsvImport.mockRejectedValue(
      new CsvImportUnresolvedError({
        rows: [{}, {}],
        newItems: [{ name: 'salmon' }],
        linkedItemCount: 4,
        unmatchedItems: ['salmon'],
        items: [{ id: 'item-1' }],
      }),
    )

    const { status, body } = await callRoute(POST, commitRequest(), {
      uploadId: UPLOAD_ID,
    })

    expect(status).toBe(409)
    expect(body).toMatchObject({
      error: 'Some items still need your call.',
      summary: {
        rowsToImport: 2,
        newItems: 1,
        linkedItems: 4,
        ready: false,
        unmatchedItems: ['salmon'],
      },
    })
  })

  it('never leaks an internal message on an unexpected fault', async () => {
    commitCsvImport.mockRejectedValue(
      new Error('password authentication failed for user "pantryiq"'),
    )

    const { status, body } = await callRoute(POST, commitRequest(), {
      uploadId: UPLOAD_ID,
    })

    expect(status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('password')
  })
})
