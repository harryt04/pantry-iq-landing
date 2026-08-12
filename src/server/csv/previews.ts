import { and, desc, eq, ne } from 'drizzle-orm'

import { requireSession } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { csvUploadHistory, locations } from '@/src/server/db/schema'
import { createLogger } from '@/src/server/observability/logger'
import {
  createConfiguredObjectStorage,
  type ObjectStorage,
} from '@/src/server/storage/object-storage'

import { parseCsvPreview, type CsvPreview } from './parser'
import {
  detectionFromStoredCsvMapping,
  detectColumnMappings,
  findReusableCsvMapping,
} from './mapping'
import { CSV_IMPORT_TYPES } from './upload-input'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const logger = createLogger({ service: 'pantryiq.csv.previews' })

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
      locationId: csvUploadHistory.locationId,
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
      preview: await parsePreviewWithMappings(body, upload.source, upload),
    }
  } catch (error) {
    if (error instanceof CsvPreviewNotFoundError) throw error
    logger.error(
      'CSV preview read failed',
      error instanceof Error ? error : new Error(String(error)),
      { locationId: upload.locationId, storageKey: upload.storageKey },
    )
    throw new CsvPreviewReadError()
  }
}

async function parsePreviewWithMappings(
  body: AsyncIterable<Uint8Array>,
  source: string,
  upload: { id: string; locationId: string },
): Promise<CsvPreview & { mapping: ReturnType<typeof detectColumnMappings> }> {
  const importType = CSV_IMPORT_TYPES.find((value) => value === source)
  if (!importType) throw new CsvPreviewReadError()
  const preview = await parseCsvPreview(body)

  const priorUploads = await db
    .select({ mappingUsed: csvUploadHistory.mappingUsed })
    .from(csvUploadHistory)
    .where(
      and(
        eq(csvUploadHistory.locationId, upload.locationId),
        eq(csvUploadHistory.source, importType),
        ne(csvUploadHistory.id, upload.id),
      ),
    )
    .orderBy(desc(csvUploadHistory.uploadedAt))
    .limit(20)
  const reusableMapping = findReusableCsvMapping(
    preview.columns,
    importType,
    priorUploads.map((prior) => prior.mappingUsed),
  )

  return {
    ...preview,
    mapping: reusableMapping
      ? detectionFromStoredCsvMapping(preview, importType, reusableMapping)
      : detectColumnMappings(preview, importType),
  }
}
