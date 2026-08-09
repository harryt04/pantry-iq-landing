import { describe, expect, it } from 'vitest'

import { rankPrecomputedItems, rankRecommendations } from './ranking'

const dimensions = (
  impact: string,
  urgency: string,
  dataSufficiency: string,
) => ({ impact, urgency, dataSufficiency })

describe('recommendation ranking', () => {
  it('applies the documented weighted formula and divisor', () => {
    const [result] = rankRecommendations([
      { itemId: 'salmon', dimensions: dimensions('100', '50', '0') },
    ])

    expect(result).toMatchObject({
      itemId: 'salmon',
      rank: 1,
      score: '60',
      dimensions: {
        impact: { score: '100', weight: '0.4' },
        urgency: { score: '50', weight: '0.4' },
        dataSufficiency: {
          score: '0',
          weight: '0.2',
        },
      },
    })
  })

  it('accepts a fourth dimension and proportionally rebalances existing weights', () => {
    const [result] = rankRecommendations(
      [
        {
          itemId: 'seasonal-salmon',
          dimensions: {
            ...dimensions('100', '50', '0'),
            seasonality: '100',
          },
        },
      ],
      { weights: { seasonality: '0.15' } },
    )

    expect(result?.score).toBe('65.22')
    expect(result?.dimensions.seasonality).toEqual({
      score: '100',
      weight: '0.15',
    })
  })

  it('filters below the impact floor and returns at most five candidates', () => {
    const results = rankRecommendations(
      Array.from({ length: 7 }, (_, index) => ({
        itemId: `item-${index}`,
        dimensions: dimensions(String(index * 10), String(index * 10), '50'),
      })),
      { lowImpact: '20' },
    )

    expect(results).toHaveLength(5)
    expect(results.map(({ itemId, rank }) => [itemId, rank])).toEqual([
      ['item-6', 1],
      ['item-5', 2],
      ['item-4', 3],
      ['item-3', 4],
      ['item-2', 5],
    ])
  })

  it('breaks equal ranking scores by impact and then item id', () => {
    const results = rankRecommendations([
      { itemId: 'zebra', dimensions: dimensions('40', '60', '50') },
      { itemId: 'alpha', dimensions: dimensions('40', '60', '50') },
      { itemId: 'higher-impact', dimensions: dimensions('60', '40', '50') },
    ])

    expect(results.map(({ itemId }) => itemId)).toEqual([
      'higher-impact',
      'alpha',
      'zebra',
    ])
  })

  it('only selects complete calculated metrics for the dashboard', () => {
    const metric = (metricKey: string, value: string) => ({
      metricKey,
      status: 'calculated' as const,
      value,
    })
    const results = rankPrecomputedItems([
      {
        itemId: 'complete',
        metrics: [
          metric('impact', '80'),
          metric('urgency', '20'),
          metric('dataSufficiency', '50'),
        ],
      },
      {
        itemId: 'missing-impact',
        metrics: [
          { ...metric('impact', '0'), status: 'cannot-calculate', value: null },
          metric('urgency', '100'),
          metric('dataSufficiency', '100'),
        ],
      },
    ])

    expect(results.map(({ itemId }) => itemId)).toEqual(['complete'])
  })
})
