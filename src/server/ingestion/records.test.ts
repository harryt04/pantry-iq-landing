import { describe, expect, it } from 'vitest'

import {
  normalizeInventoryCount,
  normalizeLaborShift,
  normalizePurchaseOrder,
  normalizeTransaction,
} from './records'

const itemId = '11111111-1111-4111-8111-111111111111'

describe('source-independent ingestion records', () => {
  it('normalizes connector and CSV-shaped transactions to the same contract', () => {
    const transaction = normalizeTransaction({
      source: ' square ',
      externalId: ' order-line-1 ',
      transactedAt: new Date('2026-08-08T12:00:00Z'),
      itemId,
      rawItemName: ' Salmon ',
      category: ' seafood ',
      qty: '2',
      unitPrice: '10',
      totalRevenue: '20',
      totalCost: null,
      grossMargin: null,
    })

    expect(transaction).toMatchObject({
      kind: 'transaction',
      source: 'square',
      externalId: 'order-line-1',
      rawItemName: 'Salmon',
      category: 'seafood',
    })
    expect(transaction.transactedAt).not.toBe(new Date('2026-08-08T12:00:00Z'))
  })

  it('keeps purchase order lines grouped under one source identity', () => {
    const order = normalizePurchaseOrder({
      source: 'csv',
      externalId: 'po-42',
      orderedAt: new Date('2026-08-08T12:00:00Z'),
      receivedAt: null,
      supplierName: ' Sysco ',
      lines: [
        {
          itemId,
          rawItemName: 'Salmon',
          qty: '4',
          unitCost: '6',
          totalCost: '24',
        },
      ],
    })

    expect(order).toMatchObject({
      kind: 'purchase_order',
      externalId: 'po-42',
      supplierName: 'Sysco',
    })
    expect(order.lines).toHaveLength(1)
  })

  it('normalizes labor with an internal employee reference', () => {
    const labor = normalizeLaborShift({
      source: ' csv ',
      externalId: ' shift-42 ',
      shiftStart: new Date('2026-08-08T15:00:00Z'),
      shiftEnd: new Date('2026-08-08T23:00:00Z'),
      employeeReference: ' staff-7 ',
      role: ' Line cook ',
      scheduledHours: '8',
      actualHours: '7.5',
      laborCost: '135.25',
    })

    expect(labor).toMatchObject({
      kind: 'labor',
      source: 'csv',
      externalId: 'shift-42',
      employeeReference: 'staff-7',
      role: 'Line cook',
      scheduledHours: '8',
      actualHours: '7.5',
      laborCost: '135.25',
    })
  })

  it('requires a role and at least one hours measure', () => {
    expect(() =>
      normalizeLaborShift({
        source: 'csv',
        externalId: 'shift-1',
        shiftStart: new Date(),
        shiftEnd: null,
        employeeReference: null,
        role: 'Server',
        scheduledHours: null,
        actualHours: null,
        laborCost: null,
      }),
    ).toThrow('hours')

    expect(() =>
      normalizeLaborShift({
        source: 'csv',
        externalId: 'shift-1',
        shiftStart: new Date(),
        shiftEnd: null,
        employeeReference: null,
        role: ' ',
        scheduledHours: '8',
        actualHours: null,
        laborCost: null,
      }),
    ).toThrow('role')
  })

  it('rejects source records without a stable identity or canonical item', () => {
    expect(() =>
      normalizeTransaction({
        source: 'csv',
        externalId: ' ',
        transactedAt: new Date(),
        itemId,
        rawItemName: 'Salmon',
        category: null,
        qty: '1',
        unitPrice: '1',
        totalRevenue: '1',
        totalCost: null,
        grossMargin: null,
      }),
    ).toThrow('external ID')

    expect(() =>
      normalizeInventoryCount({
        source: 'csv',
        externalId: null,
        countedAt: new Date(),
        itemId: ' ',
        qty: '1',
      }),
    ).toThrow('canonical item ID')
  })
})
