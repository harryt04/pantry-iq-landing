import { describe, expect, it } from 'vitest'

import { buildPrecomputeResults } from './precompute'

const now = new Date('2026-08-08T12:00:00.000Z')

const input = {
  items: [{ id: 'item-1', unit: 'lb', costPerUnit: null }],
  sales: [
    {
      itemId: 'item-1',
      qty: '3.00',
      revenue: '30.00',
      transactedAt: new Date('2026-08-01T12:00:00.000Z'),
    },
  ],
  orders: [
    {
      itemId: 'item-1',
      qty: '5.00',
      totalCost: '50.00',
      orderedAt: new Date('2026-07-31T12:00:00.000Z'),
    },
  ],
  snapshots: [
    {
      itemId: 'item-1',
      qty: '1.00',
      countedAt: new Date('2026-08-02T12:00:00.000Z'),
    },
  ],
} as const

describe('precompute results', () => {
  it('persists every MET-01 metric with exact evidence', () => {
    const output = buildPrecomputeResults(input, now)
    const metrics = output.itemResults[0]?.metrics

    expect(metrics).toHaveLength(5)
    expect(metrics?.map((metric) => metric.metricKey)).toEqual([
      'sellThrough',
      'spoilageEstimate',
      'spoilageRisk',
      'margin',
      'variance',
    ])
    expect(metrics?.map((metric) => metric.value)).toEqual([
      '60',
      '1',
      '10',
      '0',
      '20',
    ])
    expect(metrics?.[0]?.result).toMatchObject({
      status: 'calculated',
      inputs: { qtySold: '3', qtyOrdered: '5' },
      units: { value: '%' },
    })
    expect(output.rollups.map((metric) => metric.value)).toEqual([
      '60',
      '1',
      '10',
      '0',
      '20',
    ])
  })

  it('is deterministic when the source rows and run time are unchanged', () => {
    expect(buildPrecomputeResults(input, now)).toEqual(
      buildPrecomputeResults(input, now),
    )
  })

  it('keeps missing inputs explicit instead of turning them into zeroes', () => {
    const output = buildPrecomputeResults(
      {
        items: [{ id: 'item-1', unit: 'each', costPerUnit: null }],
        sales: [],
        orders: [],
        snapshots: [],
      },
      now,
    )

    expect(output.itemResults[0]?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'margin',
          status: 'cannot-calculate',
          value: null,
          result: expect.objectContaining({
            reason: 'cannot calculate, no revenue',
          }),
        }),
      ]),
    )
  })

  it('computes ratio rollups from totals instead of adding percentages', () => {
    const output = buildPrecomputeResults(
      {
        items: [
          { id: 'item-1', unit: 'each', costPerUnit: '1' },
          { id: 'item-2', unit: 'each', costPerUnit: '1' },
        ],
        sales: [
          {
            itemId: 'item-1',
            qty: '1',
            revenue: '2',
            transactedAt: new Date('2026-08-01T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '1',
            revenue: '2',
            transactedAt: new Date('2026-08-01T12:00:00.000Z'),
          },
        ],
        orders: [
          {
            itemId: 'item-1',
            qty: '2',
            totalCost: '2',
            orderedAt: new Date('2026-07-31T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '8',
            totalCost: '8',
            orderedAt: new Date('2026-07-31T12:00:00.000Z'),
          },
        ],
        snapshots: [
          {
            itemId: 'item-1',
            qty: '1',
            countedAt: new Date('2026-08-02T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '7',
            countedAt: new Date('2026-08-02T12:00:00.000Z'),
          },
        ],
      },
      now,
    )

    expect(output.rollups[0]?.value).toBe('20')
  })
})
