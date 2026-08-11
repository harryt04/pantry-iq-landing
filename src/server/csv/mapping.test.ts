import { describe, expect, it } from 'vitest'

import {
  detectionFromStoredCsvMapping,
  detectColumnMappings,
  findReusableCsvMapping,
  parseStoredCsvMapping,
} from './mapping'

function preview(columns: string[], rows: string[][]) {
  return {
    columns,
    previewRows: rows.map((values, rowNumber) => ({ rowNumber, values })),
  }
}

function mappingFor(
  columns: string[],
  rows: string[][],
  importType: Parameters<typeof detectColumnMappings>[1],
) {
  return detectColumnMappings(preview(columns, rows), importType)
}

describe('CSV column mapping detection', () => {
  it('maps the labor shift fields without an item column', () => {
    const detection = mappingFor(
      [
        'Shift ID',
        'Shift Start',
        'Shift End',
        'Employee Code',
        'Role',
        'Scheduled Hours',
        'Actual Hours',
        'Labor Cost',
      ],
      [
        [
          'shift-1',
          '2026-08-08T15:00:00Z',
          '2026-08-08T23:00:00Z',
          'staff-7',
          'Line cook',
          '8',
          '7.5',
          '135.25',
        ],
      ],
      'labor',
    )

    expect(detection.mapping).toEqual({
      'Shift ID': 'externalId',
      'Shift Start': 'shiftStart',
      'Shift End': 'shiftEnd',
      'Employee Code': 'employeeReference',
      Role: 'role',
      'Scheduled Hours': 'scheduledHours',
      'Actual Hours': 'actualHours',
      'Labor Cost': 'laborCost',
    })
  })

  it('auto-maps a conventional transaction export', () => {
    const detection = mappingFor(
      [
        'Transaction ID',
        'Transaction Date',
        'Item Description',
        'Quantity',
        'Unit Price',
        'Total Revenue',
      ],
      [
        ['sale-1', '2026-08-01T12:00:00Z', 'Soup', '2', '$8.50', '$17.00'],
        ['sale-2', '2026-08-02T12:00:00Z', 'Salad', '1', '$11.00', '$11.00'],
      ],
      'transactions',
    )

    expect(detection.mapping).toEqual({
      'Transaction ID': 'externalId',
      'Transaction Date': 'transactedAt',
      'Item Description': 'rawItemName',
      Quantity: 'qty',
      'Unit Price': 'unitPrice',
      'Total Revenue': 'totalRevenue',
    })
    expect(detection.columns.every((column) => column.band === 'auto')).toBe(
      true,
    )
    expect(detection.columns.every((column) => column.confidence >= 85)).toBe(
      true,
    )
  })

  it.each([
    ['purchase orders', 'purchase_orders', 'Order Date', 'orderedAt'],
    ['inventory snapshots', 'inventory', 'Count Date', 'countedAt'],
  ] as const)(
    'maps the primary date for %s',
    (_label, importType, header, field) => {
      const detection = mappingFor(
        [header, 'Item Name', 'Quantity'],
        [
          ['2026-08-01', 'Tomatoes', '4'],
          ['2026-08-02', 'Onions', '7'],
        ],
        importType,
      )

      expect(detection.mapping[header]).toBe(field)
      expect(detection.mapping['Item Name']).toBe('rawItemName')
      expect(detection.mapping.Quantity).toBe('qty')
    },
  )

  it('maps a US Foods PO number column as an identifier', () => {
    const detection = mappingFor(
      ['Vendor', 'Order Date', 'PO #', 'Item Description', 'Quantity Ordered'],
      [
        ['US Foods', '2025-03-02', 'USF-55021', 'Salmon Fillet', '30'],
        ['US Foods', '2025-03-09', 'USF-55190', 'Chicken Breast', '40'],
      ],
      'purchase_orders',
    )

    expect(detection.mapping['PO #']).toBe('externalId')
    expect(detection.columns[2]?.band).toBe('auto')
  })

  it('uses value shape as evidence for an anonymous date column', () => {
    const detection = mappingFor(
      ['col_7', 'col_8'],
      [
        ['2026-08-01', 'Soup'],
        ['2026-08-02', 'Salad'],
      ],
      'transactions',
    )

    expect(detection.mapping.col_7).toBe('transactedAt')
    expect(detection.columns[0]?.band).toBe('review')
    expect(detection.columns[0]?.evidence).toContain(
      '100% of sampled values look date.',
    )
  })

  it('gives a prior mapping more weight than a conflicting header guess', () => {
    const detection = detectColumnMappings(
      preview(['Amount'], [['17.00'], ['11.00']]),
      'transactions',
      { Amount: 'totalCost' },
    )

    expect(detection.mapping.Amount).toBe('totalCost')
    expect(detection.columns[0]?.confidence).toBeGreaterThanOrEqual(92)
    expect(detection.columns[0]?.evidence).toContain(
      'A prior mapping for this column supports this field.',
    )
  })

  it('leaves an unrecognised column available to skip', () => {
    const detection = mappingFor(
      ['Mystery note'],
      [['Tuesday special'], ['Closed early']],
      'inventory',
    )

    expect(detection.mapping['Mystery note']).toBeNull()
    expect(detection.columns[0]).toMatchObject({
      targetField: null,
      band: 'unmapped',
    })
  })

  it('returns the same result for the same input', () => {
    const input = preview(
      ['Date', 'Item', 'Qty'],
      [
        ['2026-08-01', 'Soup', '2'],
        ['2026-08-02', 'Salad', '1'],
      ],
    )

    expect(detectColumnMappings(input, 'transactions')).toEqual(
      detectColumnMappings(input, 'transactions'),
    )
  })

  it('reuses a stored mapping only when the complete column shape matches', () => {
    const stored = {
      Date: 'transactedAt',
      Item: 'rawItemName',
      Qty: 'qty',
    }

    expect(
      findReusableCsvMapping(['Date', 'Item', 'Qty'], 'transactions', [stored]),
    ).toEqual(stored)
    expect(
      findReusableCsvMapping(['Date', 'Item', 'Quantity'], 'transactions', [
        stored,
      ]),
    ).toBeNull()
    expect(
      findReusableCsvMapping(['Date', 'Date'], 'transactions', [
        { Date: 'transactedAt', Item: 'rawItemName' },
      ]),
    ).toBeNull()
  })

  it('turns a reused mapping into an all-decided detection', () => {
    const detection = detectionFromStoredCsvMapping(
      preview(['Date', 'Mystery'], [['2026-08-01', 'Tuesday special']]),
      'transactions',
      { Date: 'transactedAt', Mystery: null },
    )

    expect(detection.reused).toBe(true)
    expect(detection.columns.every((column) => column.band === 'auto')).toBe(
      true,
    )
    expect(detection.mapping).toEqual({ Date: 'transactedAt', Mystery: null })
  })

  it('rejects stored fields that are not valid for the import type', () => {
    expect(
      parseStoredCsvMapping({ Date: 'orderedAt' }, 'transactions'),
    ).toBeNull()
    const mapping = parseStoredCsvMapping({ Date: null }, 'transactions')
    expect(mapping).toEqual({ Date: null })
    expect(Object.getPrototypeOf(mapping)).toBe(Object.prototype)
  })
})
