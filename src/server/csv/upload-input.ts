import { CsvSecurityError, MAX_CSV_UPLOAD_BYTES } from './security'

export const CSV_IMPORT_TYPES = [
  'transactions',
  'purchase_orders',
  'inventory',
] as const

export type CsvImportType = (typeof CSV_IMPORT_TYPES)[number]

export class CsvUploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvUploadValidationError'
  }
}

function isCsvImportType(value: string): value is CsvImportType {
  return (CSV_IMPORT_TYPES as readonly string[]).includes(value)
}

function validateFilename(filename: string): string {
  const value = filename.trim()
  if (
    value.length === 0 ||
    value.length > 255 ||
    [...value].some((character) => character.charCodeAt(0) < 0x20)
  ) {
    throw new CsvUploadValidationError(
      'Choose a CSV file with a readable name.',
    )
  }
  return value
}

export function validateCsvUploadHeaders(input: {
  filename: string
  importType: string
  contentLength?: string | null
}) {
  const filename = validateFilename(input.filename)
  if (!isCsvImportType(input.importType)) {
    throw new CsvUploadValidationError(
      'Choose what kind of data this CSV contains.',
    )
  }

  if (input.contentLength) {
    const contentLength = Number(input.contentLength)
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new CsvUploadValidationError('The file size could not be read.')
    }
    if (contentLength > MAX_CSV_UPLOAD_BYTES) {
      throw new CsvSecurityError('UPLOAD_TOO_LARGE')
    }
  }

  return { filename, importType: input.importType as CsvImportType }
}
