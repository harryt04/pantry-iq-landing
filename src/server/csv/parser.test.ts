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
