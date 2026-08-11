import { describe, expect, it } from 'vitest'

import { parseCsvPreview, parseCsvRows } from './parser'

async function* chunks(bytes: Uint8Array, size = bytes.length) {
  for (let offset = 0; offset < bytes.length; offset += size)
    yield bytes.subarray(offset, offset + size)
}

function utf8(value: string) {
  return new TextEncoder().encode(value)
}

describe('CSV preview parser', () => {
  it('replays all data rows for the atomic commit while preserving source row numbers', async () => {
    const rows = await parseCsvRows(
      chunks(utf8('Date,Item,Qty\n2026-08-01,Salmon,2\n2026-08-02,Cod,1\n'), 5),
    )

    expect(rows).toMatchObject({
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty'],
      rows: [
        { rowNumber: 2, values: ['2026-08-01', 'Salmon', '2'] },
        { rowNumber: 3, values: ['2026-08-02', 'Cod', '1'] },
      ],
    })
  })

  it('detects a UTF-8 BOM, comma delimiter, headers, quotes, and newlines', async () => {
    const preview = await parseCsvPreview(
      chunks(
        utf8(
          '\uFEFFDate,Item,Qty\r\n2026-08-01,"Soup, tomato",2\r\n2026-08-02,"Note\ninside",1\r\n',
        ),
        7,
      ),
    )

    expect(preview).toMatchObject({
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty'],
      columnCount: 3,
      rowCount: 2,
      readableRowCount: 2,
    })
    expect(preview.previewRows[0]?.values).toEqual([
      '2026-08-01',
      'Soup, tomato',
      '2',
    ])
    expect(preview.previewRows[1]?.values).toEqual([
      '2026-08-02',
      'Note\ninside',
      '1',
    ])
  })

  it('skips report preamble rows before detecting the real header', async () => {
    const input = [
      'Toast POS Sales Summary',
      'Location: Downtown',
      'Date Range: 2025-03-01 to 2025-03-05',
      'Generated: 2025-03-06 08:00:00',
      '',
      'Date,Item Name,Qty,Total Revenue',
      '2025-03-01,Salmon Fillet,2,48.00',
    ].join('\n')

    const preview = await parseCsvPreview(chunks(utf8(input)))
    const rows = await parseCsvRows(chunks(utf8(input)))

    expect(preview).toMatchObject({
      hasHeader: true,
      columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
      rowCount: 1,
      readableRowCount: 1,
    })
    expect(preview.previewRows).toEqual([
      { rowNumber: 6, values: ['2025-03-01', 'Salmon Fillet', '2', '48.00'] },
    ])
    expect(rows).toMatchObject({
      hasHeader: true,
      columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
      rows: [
        {
          rowNumber: 6,
          values: ['2025-03-01', 'Salmon Fillet', '2', '48.00'],
        },
      ],
    })
  })

  it('detects headers when a source repeats a column name', async () => {
    const input =
      'Date,Item,Qty,Total,Total\n2025-03-01,Salmon Fillet,2,48.00,48.00\n'

    const preview = await parseCsvPreview(chunks(utf8(input)))
    const rows = await parseCsvRows(chunks(utf8(input)))

    expect(preview).toMatchObject({
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty', 'Total', 'Total (2)'],
      rowCount: 1,
      readableRowCount: 1,
    })
    expect(rows).toMatchObject({
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty', 'Total', 'Total (2)'],
      rows: [
        {
          rowNumber: 2,
          values: ['2025-03-01', 'Salmon Fillet', '2', '48.00', '48.00'],
        },
      ],
    })
  })

  it.each([
    ['semicolon', 'Date;Item;Qty\n2026-08-01;Salmon;3\n', ';'],
    ['tab', 'Date\tItem\tQty\n2026-08-01\tSalmon\t3\n', '\t'],
  ] as const)(
    'detects a %s-delimited export',
    async (_name, input, delimiter) => {
      const preview = await parseCsvPreview(chunks(utf8(input)))

      expect(preview.delimiter).toBe(delimiter)
      expect(preview.columns).toEqual(['Date', 'Item', 'Qty'])
      expect(preview.previewRows[0]?.values).toEqual([
        '2026-08-01',
        'Salmon',
        '3',
      ])
    },
  )

  it('decodes a complete Latin-1 export instead of mistaking the final accent for UTF-8', async () => {
    const latin1 = new Uint8Array([
      ...utf8('Item;Qty\nCaf'),
      0xe9,
      ...utf8(';2\n'),
    ])

    const preview = await parseCsvPreview(chunks(latin1, 3))

    expect(preview.encoding).toBe('latin-1')
    expect(preview.previewRows[0]?.values).toEqual(['Café', '2'])
  })

  it('decodes a UTF-16LE export with a byte-order mark', async () => {
    const csv = 'Date,Item,Qty\n2026-08-01,Crème brûlée,2\n'
    const encoded = Buffer.from(csv, 'utf16le')
    const utf16le = new Uint8Array(2 + encoded.length)
    utf16le.set([0xff, 0xfe])
    utf16le.set(encoded, 2)

    const preview = await parseCsvPreview(chunks(utf16le, 5))

    expect(preview.encoding).toBe('utf-16le')
    expect(preview.columns).toEqual(['Date', 'Item', 'Qty'])
    expect(preview.previewRows[0]?.values).toEqual([
      '2026-08-01',
      'Crème brûlée',
      '2',
    ])
  })

  it('decodes CP1252 smart quotes without exposing control characters', async () => {
    const cp1252 = new Uint8Array([
      0x44, 0x61, 0x74, 0x65, 0x2c, 0x49, 0x74, 0x65, 0x6d, 0x0a, 0x32, 0x30,
      0x32, 0x36, 0x2d, 0x30, 0x38, 0x2d, 0x30, 0x31, 0x2c, 0x93, 0x43, 0x68,
      0x65, 0x66, 0x92, 0x73, 0x20, 0x73, 0x61, 0x6c, 0x61, 0x64, 0x94, 0x0a,
    ])

    const preview = await parseCsvPreview(chunks(cp1252, 4))

    expect(preview.encoding).toBe('windows-1252')
    expect(preview.previewRows[0]?.values).toEqual([
      '2026-08-01',
      '“Chef’s salad”',
    ])
  })

  it('keeps readable rows and reports a malformed row by example', async () => {
    const preview = await parseCsvPreview(
      chunks(
        utf8(
          'Date,Item,Qty\n2026-08-01,Salmon,2\n2026-08-02,Open" sauce,1\n2026-08-03,Cod,4\n',
        ),
      ),
    )

    expect(preview.rowCount).toBe(3)
    expect(preview.readableRowCount).toBe(2)
    expect(preview.previewRows.map((row) => row.values)).toEqual([
      ['2026-08-01', 'Salmon', '2'],
      ['2026-08-03', 'Cod', '4'],
    ])
    expect(preview.problems).toEqual([
      expect.objectContaining({
        count: 1,
        message: "had a quote I couldn't read",
      }),
    ])
  })

  it('names an unreadable date with a concrete example', async () => {
    const preview = await parseCsvPreview(
      chunks(utf8('Date,Item,Qty\nnot-a-date,Salmon,2\n2026-08-03,Cod,4\n')),
    )

    expect(preview.problems).toEqual([
      expect.objectContaining({
        count: 1,
        message: "had a date I couldn't read",
        example: 'not-a-date,Salmon,2',
      }),
    ])
  })

  it('keeps memory bounded to the preview while counting a large stream', async () => {
    const header = 'Date,Item,Qty\n'
    const rows = Array.from(
      { length: 10_000 },
      (_, index) => `2026-08-01,Item ${index},1\n`,
    ).join('')

    const preview = await parseCsvPreview(chunks(utf8(header + rows), 257))

    expect(preview.rowCount).toBe(10_000)
    expect(preview.readableRowCount).toBe(10_000)
    expect(preview.previewRows).toHaveLength(5)
  })
})
