import { and, eq } from 'drizzle-orm'

import { requireSession } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { csvUploadHistory, locations } from '@/src/server/db/schema'
import {
  createConfiguredObjectStorage,
  type ObjectStorage,
} from '@/src/server/storage/object-storage'

import { parseCsvPreview, type CsvPreview } from './parser'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class CsvPreviewNotFoundError extends Error {
  constructor() {
    super('That upload is not available to this account.')
    this.name = 'CsvPreviewNotFoundError'
  }
}

export class CsvPreviewReadError extends Error {
  constructor() {
    super('That file could not be read. Nothing was changed.')
    this.name = 'CsvPreviewReadError'
  }
}

export async function previewCsv(
  headers: Headers,
  uploadId: string,
  storage?: ObjectStorage,
): Promise<{
  upload: { id: string; filename: string; source: string }
  preview: CsvPreview
}> {
  const session = await requireSession(headers)
  if (!UUID_PATTERN.test(uploadId)) throw new CsvPreviewNotFoundError()

  const [upload] = await db
    .select({
      id: csvUploadHistory.id,
      filename: csvUploadHistory.filename,
      source: csvUploadHistory.source,
      storageKey: csvUploadHistory.storageKey,
    })
    .from(csvUploadHistory)
    .innerJoin(locations, eq(locations.id, csvUploadHistory.locationId))
    .where(
      and(
        eq(csvUploadHistory.id, uploadId),
        eq(locations.userId, session.user.id),
      ),
    )
    .limit(1)

  if (!upload?.storageKey) throw new CsvPreviewNotFoundError()

  try {
    const objectStorage = storage ?? createConfiguredObjectStorage()
    const body = await objectStorage.getObject(upload.storageKey)
    return {
      upload: {
        id: upload.id,
        filename: upload.filename,
        source: upload.source,
      },
      preview: await parseCsvPreview(body),
    }
  } catch (error) {
    if (error instanceof CsvPreviewNotFoundError) throw error
    throw new CsvPreviewReadError()
  }
}
