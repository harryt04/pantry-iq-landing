import { randomUUID } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import {
  assertLocationOwnership,
  createCsvStorageKey,
  CsvSecurityError,
  guardedCsvStream,
  SlidingWindowUploadRateLimiter,
} from './security'
import {
  CsvUploadValidationError,
  validateCsvUploadHeaders,
} from './upload-input'
import { requireSession } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { csvUploadHistory, locations } from '@/src/server/db/schema'
import {
  createConfiguredObjectStorage,
  type ObjectStorage,
} from '@/src/server/storage/object-storage'

export { CsvUploadValidationError } from './upload-input'

export class CsvUploadStorageError extends Error {
  constructor() {
    super(
      'The file could not be saved. Nothing was saved, so your existing data is untouched.',
    )
    this.name = 'CsvUploadStorageError'
  }
}

const uploadRateLimiter = new SlidingWindowUploadRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
})

async function* requestBodyChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) return
      yield next.value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function uploadCsv(input: {
  headers: Headers
  locationId: string
  filename: string
  importType: string
  body: ReadableStream<Uint8Array>
  storage?: ObjectStorage
  ownsLocation?: (args: {
    userId: string
    locationId: string
  }) => Promise<boolean>
}) {
  const session = await requireSession(input.headers)

  const { filename, importType } = validateCsvUploadHeaders({
    filename: input.filename,
    importType: input.importType,
    contentLength: input.headers.get('content-length'),
  })

  const uploadId = randomUUID()
  const storageKey = createCsvStorageKey({
    locationId: input.locationId,
    uploadId,
  })

  await assertLocationOwnership({
    userId: session.user.id,
    locationId: input.locationId,
    ownsLocation:
      input.ownsLocation ??
      (async ({ userId, locationId }) => {
        const owned = await db
          .select({ id: locations.id })
          .from(locations)
          .where(
            and(eq(locations.id, locationId), eq(locations.userId, userId)),
          )
          .limit(1)
        return owned.length > 0
      }),
  })

  uploadRateLimiter.consume(`${session.user.id}:${input.locationId}`)

  const storage = input.storage ?? createConfiguredObjectStorage()
  let objectAttempted = false

  try {
    objectAttempted = true
    await storage.putObject({
      key: storageKey,
      body: guardedCsvStream(requestBodyChunks(input.body)),
      contentType: 'text/csv; charset=utf-8',
    })
    const [upload] = await db
      .insert(csvUploadHistory)
      .values({
        locationId: input.locationId,
        filename,
        source: importType,
        rowsImported: 0,
        mappingUsed: {},
        storageKey,
        status: 'uploaded',
        uploadedAt: new Date(),
      })
      .returning({
        id: csvUploadHistory.id,
        filename: csvUploadHistory.filename,
        source: csvUploadHistory.source,
        storageKey: csvUploadHistory.storageKey,
        status: csvUploadHistory.status,
      })

    if (!upload) throw new CsvUploadStorageError()
    return upload
  } catch (error) {
    if (objectAttempted) {
      try {
        await storage.deleteObject(storageKey)
      } catch {
        // The original error is safer to expose than a cleanup failure.
      }
    }
    if (error instanceof CsvSecurityError) throw error
    if (error instanceof CsvUploadValidationError) throw error
    throw new CsvUploadStorageError()
  }
}
