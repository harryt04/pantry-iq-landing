import { describe, expect, it } from 'vitest'

import { buildCsvImportPlan, CsvImportValidationError } from './import-plan'

const salmon = {
  id: '11111111-1111-4111-8111-111111111111',
  canonicalName: 'salmon',
  displayName: 'Salmon',
  category: 'seafood',
  unit: 'lb',
  isActive: true,
}

describe('CSV import planning', () => {
  it('normalizes exact decimal inputs and derives missing unit price without floats', () => {
    const plan = buildCsvImportPlan({
      importType: 'transactions',
      mapping: {
        Date: 'transactedAt',
        Item: 'rawItemName',
        Qty: 'qty',
        Revenue: 'totalRevenue',
        Cost: 'totalCost',
      },
      items: [salmon],
      csv: {
        encoding: 'utf-8',
        delimiter: ',',
        hasHeader: true,
        columns: ['Date', 'Item', 'Qty', 'Revenue', 'Cost'],
        rows: [
          {
            rowNumber: 2,
            values: ['2026-08-08T12:00:00Z', 'Salmon', '3', '$30.00', '12.00'],
          },
        ],
      },
    })

    expect(plan.rows[0]?.values).toMatchObject({
      qty: '3',
      unitPrice: '10',
      totalRevenue: '30',
      totalCost: '12',
      grossMargin: '18',
    })
    expect(plan.linkedItemCount).toBe(1)
  })

  it('uses comma decimals for semicolon-delimited exports', () => {
    const plan = buildCsvImportPlan({
      importType: 'transactions',
      mapping: {
        Date: 'transactedAt',
        Item: 'rawItemName',
        Qty: 'qty',
        UnitPrice: 'unitPrice',
        Total: 'totalRevenue',
        Cost: 'totalCost',
      },
      items: [salmon],
      csv: {
        encoding: 'utf-8',
        delimiter: ';',
        hasHeader: true,
        columns: ['Date', 'Item', 'Qty', 'UnitPrice', 'Total', 'Cost'],
        rows: [
          {
            rowNumber: 2,
            values: [
              '2026-08-08T12:00:00Z',
              'Salmon',
              '2',
              '8,50',
              '17,00',
              '4,25',
            ],
          },
        ],
      },
    })

    expect(plan.rows[0]?.values).toMatchObject({
      qty: '2',
      unitPrice: '8.5',
      totalRevenue: '17',
      totalCost: '4.25',
      grossMargin: '12.75',
    })
  })

  it('explains unsupported currency-code and percentage formats', () => {
    const buildPlan = (unitCost: string) =>
      buildCsvImportPlan({
        importType: 'purchase_orders',
        mapping: {
          Date: 'orderedAt',
          Item: 'rawItemName',
          Qty: 'qty',
          Cost: 'unitCost',
        },
        items: [salmon],
        csv: {
          encoding: 'utf-8',
          delimiter: ',',
          hasHeader: true,
          columns: ['Date', 'Item', 'Qty', 'Cost'],
          rows: [
            {
              rowNumber: 2,
              values: ['2026-08-08', 'Salmon', '2', unitCost],
            },
          ],
        },
      })

    expect(() => buildPlan('1,234.56 USD')).toThrow(
      'Row 2: unit cost uses a currency code; enter a numeric amount with an optional leading symbol instead.',
    )
    expect(() => buildPlan('12.5%')).toThrow(
      'Row 2: unit cost uses a percentage; enter a currency amount instead.',
    )
  })

  it('holds a plan until every unmatched item receives an explicit decision', () => {
    const csv = {
      encoding: 'utf-8' as const,
      delimiter: ',' as const,
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty', 'Revenue'],
      rows: [{ rowNumber: 2, values: ['2026-08-08', 'New soup', '2', '20'] }],
    }
    const blocked = buildCsvImportPlan({
      importType: 'transactions',
      mapping: {
        Date: 'transactedAt',
        Item: 'rawItemName',
        Qty: 'qty',
        Revenue: 'totalRevenue',
      },
      items: [],
      csv,
    })
    expect(blocked.unmatchedItems[0]?.rawItemName).toBe('New soup')
    expect(blocked.rows).toHaveLength(0)

    const resolved = buildCsvImportPlan({
      importType: 'transactions',
      mapping: {
        Date: 'transactedAt',
        Item: 'rawItemName',
        Qty: 'qty',
        Revenue: 'totalRevenue',
      },
      items: [],
      csv,
      resolutions: {
        'new soup': {
          canonicalName: 'new soup',
          displayName: 'Soup of the Day',
          category: 'soup',
          unit: 'each',
          shelfLifeDays: 3,
        },
      },
    })
    expect(resolved.unmatchedItems).toHaveLength(0)
    expect(resolved.newItems).toHaveLength(1)
    expect(resolved.rows[0]?.item).toMatchObject({
      kind: 'new',
      key: 'new soup',
    })
    expect(resolved.newItems[0]?.input).toEqual({
      canonicalName: 'new soup',
      displayName: 'Soup of the Day',
      category: 'soup',
      unit: 'each',
      shelfLifeDays: 3,
    })
  })

  it('rejects ambiguous duplicate target mappings before writing anything', () => {
    expect(() =>
      buildCsvImportPlan({
        importType: 'transactions',
        mapping: { Date: 'transactedAt', First: 'qty', Second: 'qty' },
        items: [salmon],
        csv: {
          encoding: 'utf-8',
          delimiter: ',',
          hasHeader: true,
          columns: ['Date', 'First', 'Second', 'Item'],
          rows: [],
        },
      }),
    ).toThrow(CsvImportValidationError)
  })

  it('plans labor rows through the shared CSV pipeline without item resolution', () => {
    const plan = buildCsvImportPlan({
      importType: 'labor',
      mapping: {
        ID: 'externalId',
        Start: 'shiftStart',
        End: 'shiftEnd',
        Employee: 'employeeReference',
        Role: 'role',
        Scheduled: 'scheduledHours',
        Actual: 'actualHours',
        Cost: 'laborCost',
      },
      items: [],
      csv: {
        encoding: 'utf-8',
        delimiter: ',',
        hasHeader: true,
        columns: [
          'ID',
          'Start',
          'End',
          'Employee',
          'Role',
          'Scheduled',
          'Actual',
          'Cost',
        ],
        rows: [
          {
            rowNumber: 2,
            values: [
              'shift-1',
              '2026-08-08T15:00:00Z',
              '2026-08-08T23:00:00Z',
              'staff-7',
              'Line cook',
              '8',
              '7.5',
              '135.25',
            ],
          },
        ],
      },
    })

    expect(plan.unmatchedItems).toHaveLength(0)
    expect(plan.linkedItemCount).toBe(0)
    expect(plan.rows[0]?.item).toBeNull()
    expect(plan.rows[0]?.values).toMatchObject({
      externalId: 'shift-1',
      role: 'Line cook',
      scheduledHours: '8',
      actualHours: '7.5',
      laborCost: '135.25',
    })
  })
})
