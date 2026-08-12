import { describe, expect, it } from 'vitest'

import { buildDashboardRecommendations } from './dashboard-recommendations'

function recommendation(rank: number) {
  return {
    version: 1 as const,
    itemId: `item-${rank}`,
    itemName: `Item ${rank}`,
    rank,
    score: String(100 - rank),
    observation: {
      purchaseOrderCount: 1,
      quantityOrdered: '2',
      quantitySold: '1',
      sellThroughRate: '50',
      quantityOnHand: '1',
      unit: 'each',
      scores: { impact: '50', urgency: '50', dataSufficiency: '50' },
    },
    financialImpact: {
      amount: '10',
      currency: 'USD' as const,
      basis: 'currentSpoilage' as const,
    },
    suggestedAction: {
      framing: 'consider' as const,
      action: 'review-item' as const,
      timeHorizon: 'this week' as const,
    },
    dataFindings: [],
    evidenceTraceRef: {
      key: `recommendation:item-${rank}`,
      itemId: `item-${rank}`,
      inputWindowStart: '2026-01-01T00:00:00.000Z',
      inputWindowEnd: '2026-01-31T00:00:00.000Z',
    },
    evidenceTrace: {
      version: 1 as const,
      sources: [],
      calculations: [],
      assumptions: [],
    },
  }
}

describe('dashboard recommendations', () => {
  it('keeps only valid records, sorts by rank, and caps the dashboard at five', () => {
    const rows = [
      { itemId: 'item-7', result: recommendation(7) },
      { itemId: 'item-2', result: recommendation(2) },
      { itemId: 'item-1', result: recommendation(1) },
      { itemId: 'item-6', result: recommendation(6) },
      { itemId: 'item-5', result: recommendation(5) },
      { itemId: 'item-4', result: recommendation(4) },
      { itemId: 'item-3', result: recommendation(3) },
      { itemId: 'invalid', result: { itemId: 'invalid' } },
    ]

    expect(
      buildDashboardRecommendations(rows).map((item) => item.rank),
    ).toEqual([1, 2, 3, 4, 5])
  })

  it('returns no records when a metric run has no valid recommendation payloads', () => {
    expect(
      buildDashboardRecommendations([
        { itemId: 'invalid', result: null },
        { itemId: 'also-invalid', result: { version: 2 } },
      ]),
    ).toEqual([])
  })

  it('drops otherwise valid records whose evidence trace has no key', () => {
    const valid = recommendation(1)
    const incomplete = {
      ...valid,
      evidenceTraceRef: { ...valid.evidenceTraceRef, key: null },
    }

    expect(
      buildDashboardRecommendations([{ itemId: 'item-1', result: incomplete }]),
    ).toEqual([])
  })
})
