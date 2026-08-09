import { describe, expect, it } from 'vitest'

import type { RecommendationRecord } from './recommendations'
import { buildPortfolioRollup, type PortfolioLocationInput } from './portfolio'

function recommendation(itemId: string, score: string): RecommendationRecord {
  return {
    version: 1,
    itemId,
    itemName: itemId,
    rank: 1,
    score,
    observation: {
      purchaseOrderCount: 1,
      quantityOrdered: '1',
      quantitySold: '0',
      sellThroughRate: '0',
      quantityOnHand: '1',
      unit: 'unit',
      scores: { impact: '50', urgency: '50', dataSufficiency: '50' },
    },
    financialImpact: { amount: '1', currency: 'USD', basis: 'currentSpoilage' },
    suggestedAction: {
      framing: 'consider',
      action: 'review-item',
      timeHorizon: 'this week',
    },
    dataFindings: [],
    evidenceTraceRef: {
      key: `${itemId}-trace`,
      itemId,
      inputWindowStart: '2026-01-01T00:00:00.000Z',
      inputWindowEnd: '2026-01-08T00:00:00.000Z',
    },
  }
}

function location(
  locationId: string,
  locationName: string,
  amount: string | null,
  recommendations: readonly RecommendationRecord[] = [],
): PortfolioLocationInput {
  return {
    locationId,
    locationName,
    metricStatus: 'ready',
    moneyAtRisk:
      amount === null
        ? { status: 'cannot-calculate', amount: null, reason: 'missing cost' }
        : { status: 'calculated', amount },
    recommendations,
    computedAt: new Date('2026-01-08T00:00:00.000Z'),
  }
}

describe('portfolio rollup', () => {
  it('sums exact-decimal location totals and preserves reconciliation status', () => {
    const result = buildPortfolioRollup([
      location('one', 'North', '10.25'),
      location('two', 'South', '2.5'),
    ])

    expect(result.moneyAtRisk).toEqual({
      status: 'calculated',
      amount: '12.75',
    })
    expect(result.locations.map(({ locationName }) => locationName)).toEqual([
      'North',
      'South',
    ])
  })

  it('marks the total partial when one location cannot provide a dollar value', () => {
    const result = buildPortfolioRollup([
      location('one', 'North', '10'),
      location('two', 'South', null),
    ])

    expect(result.moneyAtRisk.status).toBe('partial')
    expect(result.moneyAtRisk.amount).toBe('10')
    expect(result.moneyAtRisk.reason).toContain('1 location')
  })

  it('ranks recommendations across locations by the shared score without floats', () => {
    const result = buildPortfolioRollup([
      location('one', 'North', '1', [recommendation('north-item', '70.1')]),
      location('two', 'South', '1', [recommendation('south-item', '70.10')]),
      location('three', 'West', '1', [recommendation('west-item', '80')]),
    ])

    expect(
      result.recommendations.map(({ itemId, rank, locationName }) => ({
        itemId,
        rank,
        locationName,
      })),
    ).toEqual([
      { itemId: 'west-item', rank: 1, locationName: 'West' },
      { itemId: 'north-item', rank: 2, locationName: 'North' },
      { itemId: 'south-item', rank: 3, locationName: 'South' },
    ])
  })
})
