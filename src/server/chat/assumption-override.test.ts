import { describe, expect, it } from 'vitest'

import {
  applyAssumptionOverride,
  compareAssumptionOverride,
  parseAssumptionOverride,
} from './assumption-override'

const now = new Date('2026-08-08T12:00:00.000Z')
const input = {
  items: [
    {
      id: 'salmon',
      displayName: 'Salmon',
      unit: 'lb',
      costPerUnit: '20',
      shelfLifeDays: 3,
    },
  ],
  sales: [
    {
      itemId: 'salmon',
      qty: '0',
      revenue: '0',
      transactedAt: new Date('2026-08-01T12:00:00.000Z'),
    },
  ],
  orders: [
    {
      itemId: 'salmon',
      qty: '2',
      totalCost: '40',
      orderedAt: new Date('2026-08-01T12:00:00.000Z'),
    },
  ],
  snapshots: [
    {
      itemId: 'salmon',
      qty: '2',
      countedAt: new Date('2026-08-07T12:00:00.000Z'),
    },
  ],
} as const

describe('assumption override', () => {
  it('normalizes supported values and rejects unsupported assumptions', () => {
    expect(
      parseAssumptionOverride({
        itemId: 'salmon',
        field: 'shelfLifeDays',
        value: '7',
      }),
    ).toEqual({ itemId: 'salmon', field: 'shelfLifeDays', value: 7 })
    expect(() =>
      parseAssumptionOverride({
        itemId: 'salmon',
        field: 'parLevel',
        value: '12',
      }),
    ).toThrow('cannot be changed from Chat')
  })

  it('changes only the selected item and never mutates source input', () => {
    const override = parseAssumptionOverride({
      itemId: 'salmon',
      field: 'shelfLifeDays',
      value: '7',
    })
    const updated = applyAssumptionOverride(input, override)

    expect(updated.items[0]?.shelfLifeDays).toBe(7)
    expect(input.items[0]?.shelfLifeDays).toBe(3)
  })

  it('returns before and after figures from deterministic precompute output', () => {
    const comparison = compareAssumptionOverride(
      input,
      parseAssumptionOverride({
        itemId: 'salmon',
        field: 'shelfLifeDays',
        value: '30',
      }),
      now,
    )

    expect(comparison).toMatchObject({
      itemName: 'Salmon',
      beforeValue: 3,
      afterValue: 30,
      calculation: 'deterministic-precompute',
      before: { urgencyScore: '38' },
      after: { urgencyScore: '0' },
    })
  })
})
