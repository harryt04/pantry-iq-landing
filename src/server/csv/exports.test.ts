import { describe, expect, it } from 'vitest'

import { csvExportDocument, isCsvExportType } from './export-format'

describe('CSV exports', () => {
  it('writes re-importable transaction columns without changing exact decimals', () => {
    const csv = csvExportDocument('transactions', [
      [
        new Date('2026-08-08T04:00:00.000Z'),
        'sale-1',
        'Salmon',
        'Protein',
        '2.500',
        '19.995',
        '49.9875',
        '-3.125',
        '53.1125',
      ],
    ])

    expect(csv).toBe(
      'transaction date,external id,item name,category,quantity,unit price,total revenue,total cost,gross margin\r\n' +
        '2026-08-08T04:00:00.000Z,sale-1,Salmon,Protein,2.500,19.995,49.9875,-3.125,53.1125\r\n',
    )
  })

  it('quotes text safely while preserving stable purchase-order grouping', () => {
    const csv = csvExportDocument('purchase_orders', [
      [
        new Date('2026-08-08T04:00:00.000Z'),
        null,
        'order-1',
        'Supplier, Inc.',
        '=unsafe item',
        '1',
        '2.50',
        '2.50',
      ],
    ])

    expect(csv).toContain('"Supplier, Inc."')
    expect(csv).toContain("'=unsafe item")
    expect(csv).toContain(',order-1,')
  })

  it('supports every export dataset and rejects unknown route values', () => {
    expect(isCsvExportType('transactions')).toBe(true)
    expect(isCsvExportType('inventory_snapshots')).toBe(true)
    expect(isCsvExportType('all')).toBe(false)
  })
})
