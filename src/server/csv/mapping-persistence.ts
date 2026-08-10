import { and, eq } from 'drizzle-orm'

import { ForbiddenError, requireSession } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { csvUploadHistory, locations } from '@/src/server/db/schema'

import { parseStoredCsvMapping, type StoredCsvMapping } from './mapping'
import { CSV_IMPORT_TYPES, type CsvImportType } from './upload-input'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class CsvMappingNotFoundError extends Error {
  constructor() {
    super('That upload is not available to this account.')
    this.name = 'CsvMappingNotFoundError'
  }
}

export class CsvMappingValidationError extends Error {
  constructor() {
    super('Review the column mapping before saving it.')
    this.name = 'CsvMappingValidationError'
  }
}

function isImportType(value: string): value is CsvImportType {
  return (CSV_IMPORT_TYPES as readonly string[]).includes(value)
}

export function validateAcceptedCsvMapping(
  value: unknown,
  importType: CsvImportType,
): StoredCsvMapping {
  const mapping = parseStoredCsvMapping(value, importType)
  if (!mapping || Object.keys(mapping).length > 200) {
    throw new CsvMappingValidationError()
  }
  return mapping
}

export async function saveCsvMapping(
  headers: Headers,
  uploadId: string,
  value: unknown,
) {
  const session = await requireSession(headers)
  if (!UUID_PATTERN.test(uploadId)) throw new CsvMappingNotFoundError()

  const [upload] = await db
    .select({
      id: csvUploadHistory.id,
      source: csvUploadHistory.source,
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

  if (!upload || !isImportType(upload.source))
    throw new CsvMappingNotFoundError()

  const mapping = validateAcceptedCsvMapping(value, upload.source)
  const [saved] = await db
    .update(csvUploadHistory)
    .set({ mappingUsed: mapping })
    .where(eq(csvUploadHistory.id, upload.id))
    .returning({
      id: csvUploadHistory.id,
      mappingUsed: csvUploadHistory.mappingUsed,
    })

  if (!saved) throw new ForbiddenError()
  return saved
}
