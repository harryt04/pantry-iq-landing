import { Readable } from 'node:stream'

import { parse } from 'csv-parse'

const SNIFF_BYTES = 64 * 1024
const PREVIEW_ROWS = 5
const HEADER_SEARCH_ROWS = 50
const DELIMITERS = [',', ';', '\t'] as const

export type CsvEncoding = 'utf-8' | 'latin-1' | 'windows-1252' | 'utf-16le'
export type CsvDelimiter = (typeof DELIMITERS)[number]

export type CsvPreviewProblem = {
  count: number
  message: string
  example: string
}

export type CsvPreview = {
  encoding: CsvEncoding
  delimiter: CsvDelimiter
  hasHeader: boolean
  columns: string[]
  columnCount: number
  rowCount: number
  readableRowCount: number
  previewRows: Array<{ rowNumber: number; values: string[] }>
  problems: CsvPreviewProblem[]
}

export type CsvRows = {
  encoding: CsvEncoding
  delimiter: CsvDelimiter
  hasHeader: boolean
  columns: string[]
  rows: Array<{ rowNumber: number; values: string[] }>
}

type ByteStream = AsyncIterable<Uint8Array>

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

function isUtf8(bytes: Uint8Array, allowIncompleteSuffix: boolean): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    if (!allowIncompleteSuffix) return false
    for (let trim = 1; trim <= 3 && trim < bytes.length; trim += 1) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(
          bytes.subarray(0, bytes.length - trim),
        )
        return true
      } catch {
        // Continue until the possible partial UTF-8 character is removed.
      }
    }
    return false
  }
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function hasUtf8MultibyteSequence(bytes: Uint8Array): boolean {
  return bytes.some(
    (value, index) =>
      value >= 0xc2 &&
      value <= 0xf4 &&
      bytes[index + 1] !== undefined &&
      bytes[index + 1]! >= 0x80 &&
      bytes[index + 1]! <= 0xbf,
  )
}

function hasCp1252SmartQuote(bytes: Uint8Array): boolean {
  return bytes.some((value) => value >= 0x91 && value <= 0x94)
}

function decoderLabel(encoding: CsvEncoding): string {
  if (encoding === 'utf-8') return 'utf-8'
  if (encoding === 'latin-1') return 'iso-8859-1'
  return encoding
}

function decode(bytes: Uint8Array, encoding: CsvEncoding): string {
  return new TextDecoder(decoderLabel(encoding)).decode(bytes)
}

function delimiterScore(text: string, delimiter: string): number {
  let fields = 1
  let quoted = false
  let records = 0
  let usefulRecords = 0
  let consistentRecords = 0
  let currentFields = 1
  const widths: number[] = []

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1
        continue
      }
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (character === delimiter) {
      currentFields += 1
      fields += 1
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      records += 1
      widths.push(currentFields)
      if (currentFields > 1) usefulRecords += 1
      currentFields = 1
    }
  }

  if (currentFields > 1 || text.length > 0) {
    records += 1
    widths.push(currentFields)
    if (currentFields > 1) usefulRecords += 1
  }

  if (records === 0 || usefulRecords === 0) return 0

  const mode = widths
    .filter((width) => width > 1)
    .sort((left, right) => left - right)[
    Math.floor(widths.filter((width) => width > 1).length / 2)
  ]
  for (const width of widths) {
    if (width === mode) consistentRecords += 1
  }

  return usefulRecords * 1000 + consistentRecords * 10 + fields
}

function detectDelimiter(text: string): CsvDelimiter {
  let best: CsvDelimiter = ','
  let bestScore = -1
  for (const delimiter of DELIMITERS) {
    const score = delimiterScore(text, delimiter)
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }
  return best
}

async function prepareInput(input: ByteStream): Promise<{
  encoding: CsvEncoding
  delimiter: CsvDelimiter
  chunks: AsyncIterable<string>
}> {
  const iterator = input[Symbol.asyncIterator]()
  const sniffChunks: Uint8Array[] = []
  let sniffBytes = 0
  let remainder: Uint8Array | undefined
  let finished = false

  while (sniffBytes < SNIFF_BYTES) {
    const next = await iterator.next()
    if (next.done) {
      finished = true
      break
    }
    const chunk = next.value
    const remaining = SNIFF_BYTES - sniffBytes
    if (chunk.length <= remaining) {
      sniffChunks.push(chunk)
      sniffBytes += chunk.length
    } else {
      sniffChunks.push(chunk.subarray(0, remaining))
      remainder = chunk.subarray(remaining)
      sniffBytes += remaining
      break
    }
  }

  const sniff = joinBytes(sniffChunks)
  const encoding: CsvEncoding = hasPrefix(sniff, [0xff, 0xfe])
    ? 'utf-16le'
    : isUtf8(sniff, !finished)
      ? 'utf-8'
      : hasCp1252SmartQuote(sniff)
        ? 'windows-1252'
        : 'latin-1'
  const sample = decode(sniff, encoding).replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(sample)

  async function* chunks() {
    const decoder = new TextDecoder(decoderLabel(encoding))
    if (sniff.length > 0) yield decoder.decode(sniff, { stream: !finished })
    if (remainder && remainder.length > 0)
      yield decoder.decode(remainder, { stream: !finished })
    if (!finished) {
      while (true) {
        const next = await iterator.next()
        if (next.done) break
        yield decoder.decode(next.value, { stream: true })
      }
      const final = decoder.decode()
      if (final) yield final
    } else {
      const final = decoder.decode()
      if (final) yield final
    }
  }

  return { encoding, delimiter, chunks: chunks() }
}

function normalizedHeader(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[_-]+/g, ' ')
}

function looksNumeric(value: string): boolean {
  const normalized = value.trim().replaceAll(',', '')
  return (
    normalized.length === 0 ||
    /^[-+]?\$?\d+(\.\d+)?%?$/.test(normalized) ||
    /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(normalized)
  )
}

function looksLikeHeader(first: string[], second?: string[]) {
  const values = first.map(normalizedHeader)
  // Some exports repeat a source label (for example, two Total columns).
  // `columnNames()` disambiguates those labels for downstream mapping, so
  // duplicate non-empty names must not make an otherwise valid header look
  // like data. Empty labels still need a signal from a named column.
  const hasUsableLabels = values.every((value) => value.length > 0)
  const signals = values.filter((value) =>
    /date|time|item|product|description|qty|quantity|amount|revenue|sales|cost|category|unit|supplier|vendor|order|received|on hand|stock/.test(
      value,
    ),
  ).length
  const firstLooksNumeric = first.filter(looksNumeric).length
  const secondLooksLikeData = second?.some(looksNumeric) ?? false

  return (
    first.length >= 2 &&
    hasUsableLabels &&
    firstLooksNumeric < Math.ceil(first.length / 2) &&
    (signals > 0 || secondLooksLikeData)
  )
}

function findHeaderIndex(records: string[][]): number | null {
  const searchLimit = Math.min(records.length, HEADER_SEARCH_ROWS)
  for (let index = 0; index < searchLimit; index += 1) {
    const row = records[index]
    const next = records[index + 1]
    if (!row || !looksLikeHeader(row, next)) continue

    // A preamble can contain words such as "Date" or "Sales". Requiring a
    // following row with the same width makes a later candidate look like a
    // table header rather than a report label.
    if (index === 0 || (next && next.length === row.length)) return index
  }
  return null
}

function columnNames(header: string[], columnCount: number): string[] {
  const names: string[] = []
  const used = new Map<string, number>()
  for (let index = 0; index < columnCount; index += 1) {
    const base = header[index]?.trim() || `Column ${index + 1}`
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    names.push(seen === 0 ? base : `${base} (${seen + 1})`)
  }
  return names
}

function problemMessage(code: string | undefined): string {
  if (code === 'UNREADABLE_DATE') return "had a date I couldn't read"
  if (code === 'CSV_RECORD_INCONSISTENT_FIELDS')
    return 'had a different number of columns than the header'
  if (code?.includes('QUOTE')) return "had a quote I couldn't read"
  return "had a row I couldn't read"
}

function exampleText(raw: string | undefined): string {
  const value = (raw ?? '').trim().replaceAll(/\s+/g, ' ')
  return value.length > 160
    ? `${value.slice(0, 157)} (truncated)`
    : value || 'the row was empty'
}

export async function parseCsvPreview(input: ByteStream): Promise<CsvPreview> {
  const prepared = await prepareInput(input)
  const problems = new Map<string, CsvPreviewProblem>()
  let sourceRowCount = 0
  let skippedRowCount = 0

  const parser = parse({
    bom: true,
    delimiter: prepared.delimiter,
    encoding: 'utf8',
    info: false,
    relax_column_count: true,
    skip_empty_lines: true,
    skip_records_with_error: true,
    on_skip: (error, raw) => {
      const message = problemMessage(error?.code)
      const existing = problems.get(message)
      sourceRowCount += 1
      skippedRowCount += 1
      if (existing) {
        existing.count += 1
      } else {
        problems.set(message, {
          count: 1,
          message,
          example: exampleText(raw),
        })
      }
    },
  })
  Readable.from(prepared.chunks).pipe(parser)

  const bufferedRows: Array<{ row: string[]; rowNumber: number }> = []
  const previewRows: Array<{ rowNumber: number; values: string[] }> = []
  let hasHeader = false
  let header: string[] = []
  let columnCount = 0
  let readableRowCount = 0
  let dataRowCount = 0
  let dateColumnIndexes: number[] = []
  let headerResolved = false

  function addProblem(code: string, example: string) {
    const message = problemMessage(code)
    const existing = problems.get(message)
    if (existing) {
      existing.count += 1
    } else {
      problems.set(message, { count: 1, message, example })
    }
  }

  function processDataRow(row: string[], rowNumber: number) {
    dataRowCount += 1
    readableRowCount += 1
    columnCount = Math.max(columnCount, row.length)
    if (previewRows.length < PREVIEW_ROWS)
      previewRows.push({ rowNumber, values: row })
    if (hasHeader && row.length !== header.length)
      addProblem(
        'CSV_RECORD_INCONSISTENT_FIELDS',
        exampleText(row.join(prepared.delimiter)),
      )
    for (const index of dateColumnIndexes) {
      const value = row[index]?.trim() ?? ''
      if (value && (Number.isNaN(Date.parse(value)) || !/[0-9]/.test(value)))
        addProblem('UNREADABLE_DATE', exampleText(row.join(prepared.delimiter)))
    }
  }

  function resolveHeader(index: number | null) {
    hasHeader = index !== null
    header = index === null ? [] : (bufferedRows[index]?.row ?? [])
    columnCount = hasHeader ? header.length : 0
    dateColumnIndexes = header.reduce<number[]>(
      (indexes, value, columnIndex) => {
        if (/date|time/.test(normalizedHeader(value))) indexes.push(columnIndex)
        return indexes
      },
      [],
    )

    const dataRows =
      index === null ? bufferedRows : bufferedRows.slice(index + 1)
    for (const { row, rowNumber } of dataRows) processDataRow(row, rowNumber)
    headerResolved = true
  }

  for await (const record of parser) {
    sourceRowCount += 1
    const row = record as string[]
    if (!headerResolved) {
      bufferedRows.push({ row, rowNumber: sourceRowCount })
      const headerIndex = findHeaderIndex(
        bufferedRows.map(({ row: values }) => values),
      )
      if (headerIndex !== null || bufferedRows.length === HEADER_SEARCH_ROWS)
        resolveHeader(headerIndex)
      continue
    }
    processDataRow(row, sourceRowCount)
  }

  if (!headerResolved)
    resolveHeader(
      findHeaderIndex(bufferedRows.map(({ row: values }) => values)),
    )

  const columns = columnNames(hasHeader ? header : [], columnCount)

  return {
    encoding: prepared.encoding,
    delimiter: prepared.delimiter,
    hasHeader,
    columns,
    columnCount,
    rowCount: dataRowCount + skippedRowCount,
    readableRowCount,
    previewRows,
    problems: [...problems.values()],
  }
}

/**
 * Reads the same guarded object used by the preview, but keeps every data row
 * for the commit step. Uploads are capped at 10 MB, so this bounded buffer
 * gives the database transaction one deterministic input to replay.
 */
export async function parseCsvRows(input: ByteStream): Promise<CsvRows> {
  const prepared = await prepareInput(input)
  const parser = parse({
    bom: true,
    delimiter: prepared.delimiter,
    encoding: 'utf8',
    relax_column_count: true,
    skip_empty_lines: true,
  })
  Readable.from(prepared.chunks).pipe(parser)

  const records: string[][] = []
  for await (const record of parser) records.push(record as string[])

  const headerIndex = findHeaderIndex(records)
  const hasHeader = headerIndex !== null
  const header = hasHeader ? (records[headerIndex] ?? []) : []
  const data = hasHeader ? records.slice(headerIndex + 1) : records
  const columnCount = Math.max(
    hasHeader ? header.length : 0,
    ...data.map((row) => row.length),
  )

  return {
    encoding: prepared.encoding,
    delimiter: prepared.delimiter,
    hasHeader,
    columns: columnNames(header, columnCount),
    rows: data.map((values, index) => ({
      rowNumber: hasHeader ? index + headerIndex + 2 : index + 1,
      values,
    })),
  }
}
