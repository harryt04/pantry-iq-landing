import { randomUUID } from 'node:crypto'

export const MAX_CSV_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_CONTENT_SAMPLE_BYTES = 64 * 1024

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BINARY_SIGNATURES = [
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP / XLSX
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x52, 0x49, 0x46, 0x46], // RIFF / some binary media
  [0x7f, 0x45, 0x4c, 0x46], // ELF
] as const

export type CsvSecurityErrorCode =
  | 'EMPTY_FILE'
  | 'NOT_CSV_CONTENT'
  | 'UPLOAD_TOO_LARGE'
  | 'LOCATION_NOT_OWNED'
  | 'RATE_LIMITED'

export class CsvSecurityError extends Error {
  readonly code: CsvSecurityErrorCode

  constructor(code: CsvSecurityErrorCode) {
    super('This file could not be processed.')
    this.name = 'CsvSecurityError'
    this.code = code
  }
}

function asBytes(chunk: Uint8Array | string): Uint8Array {
  return typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
}

function hasPrefix(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

function containsForbiddenControlByte(bytes: Uint8Array): boolean {
  return Array.from(bytes).some(
    (value) => value < 0x09 || (value > 0x0d && value < 0x20),
  )
}

function hasCsvShape(bytes: Uint8Array): boolean {
  const start =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  const body = bytes.subarray(start)

  return body.some(
    (value) =>
      value === 0x0a || value === 0x0d || value === 0x2c || value === 0x3b,
  )
}

/**
 * Checks content rather than trusting a browser-provided MIME type or name.
 * Latin-1 bytes are allowed here because ING-03 owns character-set decoding.
 */
export function assertCsvContent(sample: Uint8Array | string): void {
  const bytes = asBytes(sample)

  if (bytes.length === 0) {
    throw new CsvSecurityError('EMPTY_FILE')
  }

  if (
    containsForbiddenControlByte(bytes) ||
    BINARY_SIGNATURES.some((signature) => hasPrefix(bytes, signature)) ||
    !hasCsvShape(bytes)
  ) {
    throw new CsvSecurityError('NOT_CSV_CONTENT')
  }
}

/**
 * Guards an upload while it is being consumed. It never buffers the file;
 * callers should only make an object-storage key visible after this entire
 * iterable has completed successfully.
 */
export async function* guardedCsvStream(
  input: AsyncIterable<Uint8Array | string>,
  options: { maxBytes?: number } = {},
): AsyncGenerator<Uint8Array> {
  const maxBytes = options.maxBytes ?? MAX_CSV_UPLOAD_BYTES
  let totalBytes = 0
  let sample = new Uint8Array(0)

  for await (const rawChunk of input) {
    const chunk = asBytes(rawChunk)

    if (chunk.length === 0) continue

    totalBytes += chunk.length
    if (totalBytes > maxBytes) {
      throw new CsvSecurityError('UPLOAD_TOO_LARGE')
    }

    if (containsForbiddenControlByte(chunk)) {
      throw new CsvSecurityError('NOT_CSV_CONTENT')
    }

    if (sample.length < MAX_CONTENT_SAMPLE_BYTES) {
      const remaining = MAX_CONTENT_SAMPLE_BYTES - sample.length
      const next = chunk.subarray(0, remaining)
      const combined = new Uint8Array(sample.length + next.length)
      combined.set(sample)
      combined.set(next, sample.length)
      sample = combined
    }

    yield chunk
  }

  assertCsvContent(sample)
}

export function createCsvStorageKey(input: {
  locationId: string
  uploadId?: string
}): string {
  if (!UUID_PATTERN.test(input.locationId)) {
    throw new CsvSecurityError('LOCATION_NOT_OWNED')
  }

  const uploadId = input.uploadId ?? randomUUID()
  if (!UUID_PATTERN.test(uploadId)) {
    throw new CsvSecurityError('NOT_CSV_CONTENT')
  }

  return `csv/${input.locationId}/${uploadId}.csv`
}

export function neutralizeSpreadsheetFormula(value: string): string {
  // Negative numerics are valid imported values, not formulas. Preserve them
  // so an export can make the round trip without changing exact amounts.
  const isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
  return !isNumeric && /^[=+\-@]/.test(value) ? `'${value}` : value
}

export function serializeCsvRow(values: readonly string[]): string {
  return `${values
    .map((value) => {
      const safeValue = neutralizeSpreadsheetFormula(value)
      const escapedValue = safeValue.replaceAll('"', '""')
      return /[",\r\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue
    })
    .join(',')}\r\n`
}

export async function assertLocationOwnership(input: {
  userId: string
  locationId: string
  ownsLocation: (args: {
    userId: string
    locationId: string
  }) => Promise<boolean>
}): Promise<void> {
  const ownsLocation = await input.ownsLocation({
    userId: input.userId,
    locationId: input.locationId,
  })

  if (!ownsLocation) {
    throw new CsvSecurityError('LOCATION_NOT_OWNED')
  }
}

type RateLimitOptions = {
  limit: number
  windowMs: number
  now?: () => number
}

export class SlidingWindowUploadRateLimiter {
  private readonly attempts = new Map<string, number[]>()
  private readonly now: () => number

  constructor(private readonly options: RateLimitOptions) {
    this.now = options.now ?? Date.now
  }

  consume(key: string): void {
    const now = this.now()
    const windowStart = now - this.options.windowMs
    const attempts = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    )

    if (attempts.length >= this.options.limit) {
      throw new CsvSecurityError('RATE_LIMITED')
    }

    attempts.push(now)
    this.attempts.set(key, attempts)
  }
}
