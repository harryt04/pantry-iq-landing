import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL =
    'postgres://context-bundle-test:context-bundle-test@localhost:5433/context-bundle-test'
})

import {
  CONTEXT_BUNDLE_TOKEN_BUDGET,
  buildContextBundle,
  buildPortfolioContextBundle,
  estimatePortfolioContextBundleTokens,
  estimateContextBundleTokens,
  type ContextBundleInput,
  type ContextBundleMetric,
} from './context-bundle'

const location = {
  id: 'location-1',
  name: 'North Star',
  timezone: 'America/Denver',
  businessDayBoundary: '04:00:00',
} as const

const baseMetric: ContextBundleMetric = {
  itemId: 'item-1',
  metricKey: 'margin',
  status: 'calculated' as const,
  value: '12.50',
  result: { units: { value: 'USD' } },
  provenance: 'metric_results:margin',
}

function inputWith(rows: number): ContextBundleInput {
  const dates = Array.from({ length: rows }, (_, index) => {
    const date = new Date('2025-08-09T12:00:00.000Z')
    date.setUTCDate(date.getUTCDate() + index)
    return date
  })
  return {
    location,
    items: [
      {
        id: 'item-1',
        name: 'Salmon',
        category: 'Protein',
        unit: 'lb',
      },
    ],
    sales: dates.map((transactedAt) => ({
      itemId: 'item-1',
      qty: '3.00',
      transactedAt,
    })),
    orders: dates.map((orderedAt) => ({
      itemId: 'item-1',
      qty: '5.00',
      orderedAt,
    })),
    snapshots: dates.map((countedAt) => ({
      itemId: 'item-1',
      qty: '1.00',
      countedAt,
    })),
    itemMetrics: [baseMetric],
    rollupMetrics: [
      {
        ...baseMetric,
        provenance: 'metric_rollups:margin',
      },
    ],
    inputWindowStart: dates[0]!,
    inputWindowEnd: dates.at(-1)!,
  }
}

describe('interpretable context bundle', () => {
  it('contains one-location series, rollups, distributions, units, and provenance', () => {
    const result = buildContextBundle(inputWith(2))
    const item = result.bundle.items[0]
    const category = result.bundle.categories[0]

    expect(result.compacted).toBe(false)
    expect(item).toMatchObject({
      id: 'item-1',
      category: 'Protein',
      unit: 'lb',
      metrics: [
        {
          key: 'margin',
          value: {
            value: '12.50',
            unit: 'USD',
            provenance: 'metric_results:margin',
          },
        },
      ],
    })
    expect(item?.series).toEqual([
      expect.objectContaining({
        sold: { value: '3', unit: 'lb', provenance: 'transactions' },
        ordered: { value: '5', unit: 'lb', provenance: 'purchase_orders' },
        onHand: { value: '1', unit: 'lb', provenance: 'inventory_snapshots' },
      }),
      expect.objectContaining({
        sold: { value: '3', unit: 'lb', provenance: 'transactions' },
      }),
    ])
    expect(category).toMatchObject({
      name: 'Protein',
      itemIds: ['item-1'],
      itemCount: {
        value: '1',
        unit: 'items',
        provenance: 'inventory_items:category:Protein',
      },
      totals: [
        {
          bucket: 'all recorded rows',
          unit: 'lb',
          sold: { value: '6', unit: 'lb' },
          ordered: { value: '10', unit: 'lb' },
        },
      ],
    })
    expect(result.bundle.distributions.dayOfWeek).toHaveLength(7)
    expect(result.bundle.distributions.timeOfDay).toHaveLength(4)
    expect(result.bundle.metrics[0]).toMatchObject({
      key: 'margin',
      provenance: 'metric_rollups:margin',
    })
  })

  it('is byte-identical for identical normalized data', () => {
    const first = buildContextBundle(inputWith(12)).bundle
    const second = buildContextBundle(inputWith(12)).bundle

    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('compacts the oldest series points to stay within the documented budget', () => {
    const result = buildContextBundle(inputWith(365))

    expect(result.compacted).toBe(true)
    expect(result.estimatedTokens).toBeLessThanOrEqual(
      CONTEXT_BUNDLE_TOKEN_BUDGET,
    )
    expect(result.bundle.compaction.omittedSeriesPoints.value).toBe(
      String(365 - result.bundle.items[0]!.series.length),
    )
    expect(result.bundle.items[0]?.series.at(-1)?.date.value).toBe('2026-08-08')
    expect(estimateContextBundleTokens(result.bundle)).toBe(
      result.estimatedTokens,
    )
  })

  it('keeps cannot-calculate metrics explicit', () => {
    const input = inputWith(1)
    input.itemMetrics = [
      {
        ...baseMetric,
        status: 'cannot-calculate',
        value: null,
        result: {
          units: { value: 'USD' },
          reason: 'cannot calculate, no revenue',
        },
      },
    ]

    expect(buildContextBundle(input).bundle.items[0]?.metrics).toEqual([
      {
        key: 'margin',
        status: 'cannot-calculate',
        value: null,
        reason: 'cannot calculate, no revenue',
        provenance: 'metric_results:margin',
      },
    ])
  })

  it('compacts a ten-location portfolio while retaining every location name', () => {
    const inputs = Array.from({ length: 10 }, (_, index) => ({
      ...inputWith(365),
      location: {
        ...location,
        id: `location-${index + 1}`,
        name: `Location ${index + 1}`,
      },
    }))

    const first = buildPortfolioContextBundle(inputs)
    const second = buildPortfolioContextBundle(inputs)

    expect(first.compacted).toBe(true)
    expect(first.estimatedTokens).toBeLessThanOrEqual(
      CONTEXT_BUNDLE_TOKEN_BUDGET,
    )
    expect(first.bundle.locations.map(({ location }) => location.name)).toEqual(
      inputs.map(({ location: inputLocation }) => inputLocation.name),
    )
    expect(first.bundle.compaction.omittedSeriesPoints.value).not.toBe('0')
    expect(estimatePortfolioContextBundleTokens(first.bundle)).toBe(
      first.estimatedTokens,
    )
    expect(JSON.stringify(first.bundle)).toBe(JSON.stringify(second.bundle))
  })
})
