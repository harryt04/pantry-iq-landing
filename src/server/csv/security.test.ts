import { describe, expect, it } from 'vitest'

import {
  assertCsvContent,
  assertLocationOwnership,
  createCsvStorageKey,
  CsvSecurityError,
  guardedCsvStream,
  neutralizeSpreadsheetFormula,
  serializeCsvRow,
  SlidingWindowUploadRateLimiter,
} from './security'

async function consume(
  input: AsyncIterable<Uint8Array | string>,
  options?: { maxBytes?: number },
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = []
  for await (const chunk of guardedCsvStream(input, options)) {
    chunks.push(chunk)
  }
  return chunks
}

async function drain(
  input: AsyncIterable<Uint8Array | string>,
  options?: { maxBytes?: number },
): Promise<void> {
  for await (const chunk of guardedCsvStream(input, options)) {
    void chunk
  }
}

describe('CSV upload security', () => {
  it('accepts delimited text and rejects renamed binary files', () => {
    expect(() => assertCsvContent('item,qty\nSalmon,2\n')).not.toThrow()
    expect(() =>
      assertCsvContent(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
    ).toThrowError(CsvSecurityError)
    expect(() => assertCsvContent('this is not a csv')).toThrowError(
      CsvSecurityError,
    )
  })

  it('enforces the size ceiling before yielding an oversized chunk', async () => {
    const input = (async function* () {
      yield 'item,qty\n'
      yield 'Salmon,2\n'
    })()

    await expect(consume(input, { maxBytes: 10 })).rejects.toMatchObject({
      code: 'UPLOAD_TOO_LARGE',
    })
  })

  it('passes chunks through without collecting the complete file', async () => {
    const input = (async function* () {
      yield 'item,qty\n'
      yield 'Salmon,2\n'
    })()

    const chunks = await consume(input)

    expect(chunks).toHaveLength(2)
    expect(new TextDecoder().decode(chunks[1])).toBe('Salmon,2\n')
  })

  it('rejects forbidden control bytes after the bounded content sample', async () => {
    const input = (async function* () {
      yield 'item,qty\n'
      yield 'Salmon,2\n'.repeat(8_000)
      yield new Uint8Array([0x01])
    })()

    await expect(drain(input)).rejects.toMatchObject({
      code: 'NOT_CSV_CONTENT',
    })
  })

  it('neutralizes spreadsheet formulas and escapes CSV syntax', () => {
    expect(neutralizeSpreadsheetFormula('=IMPORTDATA("url")')).toBe(
      '\'=IMPORTDATA("url")',
    )
    expect(neutralizeSpreadsheetFormula('+1')).toBe("'+1")
    expect(neutralizeSpreadsheetFormula('Salmon')).toBe('Salmon')
    expect(serializeCsvRow(['item', '=SUM(A1:A2)', 'a,b'])).toBe(
      'item,\'=SUM(A1:A2),"a,b"\r\n',
    )
  })

  it('uses generated UUID keys and never incorporates a filename', () => {
    const key = createCsvStorageKey({
      locationId: '00000000-0000-4000-8000-000000000001',
      uploadId: '00000000-0000-4000-8000-000000000002',
    })

    expect(key).toBe(
      'csv/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.csv',
    )
    expect(key).not.toContain('..')
    expect(() =>
      createCsvStorageKey({
        locationId: '../../outside',
      }),
    ).toThrowError(CsvSecurityError)
  })

  it('accepts UTF-16LE CSV bytes but rejects mixed UTF-8 and CP1252 text', () => {
    const utf16le = new Uint8Array([
      0xff, 0xfe, 0x69, 0x00, 0x74, 0x00, 0x65, 0x00, 0x6d, 0x00, 0x2c, 0x00,
      0x71, 0x00, 0x74, 0x00, 0x0a, 0x00, 0x53, 0x00, 0x61, 0x00, 0x6c, 0x00,
      0x6d, 0x00, 0x6f, 0x00, 0x6e, 0x00, 0x2c, 0x00, 0x32, 0x00, 0x0a, 0x00,
    ])
    expect(() => assertCsvContent(utf16le)).not.toThrow()

    const mixed = new Uint8Array([
      0x69, 0x74, 0x65, 0x6d, 0x2c, 0x71, 0x74, 0x0a, 0x43, 0x61, 0x66, 0xc3,
      0xa9, 0x2c, 0x32, 0x0a, 0x93, 0x43, 0x68, 0x65, 0x66, 0x94, 0x2c, 0x31,
      0x0a,
    ])
    expect(() => assertCsvContent(mixed)).toThrowError(CsvSecurityError)
  })

  it('checks location ownership through one injected authorization boundary', async () => {
    const ownsLocation = async ({ userId }: { userId: string }) =>
      userId === 'owner'

    await expect(
      assertLocationOwnership({
        userId: 'owner',
        locationId: 'location',
        ownsLocation,
      }),
    ).resolves.toBeUndefined()

    await expect(
      assertLocationOwnership({
        userId: 'stranger',
        locationId: 'location',
        ownsLocation,
      }),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_OWNED' })
  })

  it('limits repeated uploads within a sliding window', () => {
    let now = 1_000
    const limiter = new SlidingWindowUploadRateLimiter({
      limit: 2,
      windowMs: 100,
      now: () => now,
    })

    limiter.consume('owner:location')
    limiter.consume('owner:location')
    expect(() => limiter.consume('owner:location')).toThrowError(
      CsvSecurityError,
    )

    now += 101
    expect(() => limiter.consume('owner:location')).not.toThrow()
  })
})
