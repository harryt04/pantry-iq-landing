import { Readable } from 'node:stream'

import { parse } from 'csv-parse'

const SNIFF_BYTES = 64 * 1024
const PREVIEW_ROWS = 5
const DELIMITERS = [',', ';', '\t'] as const

export type CsvEncoding = 'utf-8' | 'latin-1'
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

function decode(bytes: Uint8Array, encoding: CsvEncoding): string {
  return new TextDecoder(encoding === 'utf-8' ? 'utf-8' : 'iso-8859-1').decode(
    bytes,
  )
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
  const encoding: CsvEncoding = isUtf8(sniff, !finished) ? 'utf-8' : 'latin-1'
  const sample = decode(sniff, encoding).replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(sample)

  async function* chunks() {
    const decoder = new TextDecoder(
      encoding === 'utf-8' ? 'utf-8' : 'iso-8859-1',
    )
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
  const unique = new Set(values).size === values.length
  const signals = values.filter((value) =>
    /date|time|item|product|description|qty|quantity|amount|revenue|sales|cost|category|unit|supplier|vendor|order|received|on hand|stock/.test(
      value,
    ),
  ).length
  const firstLooksNumeric = first.filter(looksNumeric).length
  const secondLooksLikeData = second?.some(looksNumeric) ?? false

  return (
    first.length > 0 &&
    unique &&
    firstLooksNumeric < Math.ceil(first.length / 2) &&
    (signals > 0 || secondLooksLikeData)
  )
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
    ? `${value.slice(0, 157)}…`
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

  const bufferedRows: string[][] = []
  const previewRows: Array<{ rowNumber: number; values: string[] }> = []
  let hasHeader = false
  let header: string[] = []
  let columnCount = 0
  let readableRowCount = 0
  let dataRowCount = 0
  let dateColumnIndexes: number[] = []

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

  for await (const record of parser) {
    sourceRowCount += 1
    const row = record as string[]
    if (bufferedRows.length < 2) {
      bufferedRows.push(row)
      if (bufferedRows.length === 2) {
        hasHeader = looksLikeHeader(bufferedRows[0] ?? [], bufferedRows[1])
        header = hasHeader ? (bufferedRows[0] ?? []) : []
        columnCount = hasHeader ? header.length : 0
        dateColumnIndexes = header.reduce<number[]>((indexes, value, index) => {
          if (/date|time/.test(normalizedHeader(value))) indexes.push(index)
          return indexes
        }, [])
        if (hasHeader) {
          processDataRow(bufferedRows[1] ?? [], sourceRowCount)
        } else {
          processDataRow(bufferedRows[0] ?? [], sourceRowCount - 1)
          processDataRow(bufferedRows[1] ?? [], sourceRowCount)
        }
      }
    } else {
      processDataRow(row, sourceRowCount)
    }
  }

  if (bufferedRows.length === 1) {
    hasHeader = looksLikeHeader(bufferedRows[0] ?? [])
    header = hasHeader ? (bufferedRows[0] ?? []) : []
    columnCount = hasHeader ? header.length : 0
    if (!hasHeader) processDataRow(bufferedRows[0] ?? [], 1)
  }

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
