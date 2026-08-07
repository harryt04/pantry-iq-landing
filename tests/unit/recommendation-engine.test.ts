import { describe, expect, it } from 'vitest'
import { generateRecommendations } from '@/lib/recommendations/engine'

describe('recommendation engine', () => {
  it('separates observations from predictions when history is short', () => {
    const result = generateRecommendations({
      transactions: [
        { date: '2026-07-01', item: 'Salmon', qty: 0 },
        { date: '2026-07-07', item: 'Salmon', qty: 0 },
      ],
      purchases: [
        { purchaseDate: '2026-07-01', item: 'Salmon', qty: 10, unitCost: 12 },
      ],
      inventory: [
        { snapshotDate: '2026-07-07', item: 'Salmon', qtyOnHand: 10 },
      ],
    })

    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].observation).toContain('0% sell-through')
    expect(result.recommendations[0].prediction).toBeNull()
    expect(result.recommendations[0].financialImpact).toBe(120)
    expect(result.recommendations[0].evidence.sources).toEqual([
      'transactions',
      'purchase orders',
      'inventory snapshot',
    ])
  })

  it('labels a prediction only after four weeks of history', () => {
    const result = generateRecommendations({
      transactions: [
        { date: '2026-06-01', item: 'Chicken', qty: 1 },
        { date: '2026-07-01', item: 'Chicken', qty: 1 },
      ],
      purchases: [
        { purchaseDate: '2026-06-01', item: 'Chicken', qty: 10, unitCost: 5 },
      ],
      inventory: [],
    })

    expect(result.historyWeeks).toBeGreaterThanOrEqual(4)
    expect(result.recommendations[0].prediction).toContain('Prediction:')
  })

  it('does not invent a dollar impact when costs are unavailable', () => {
    const result = generateRecommendations({
      transactions: [{ date: '2026-07-01', item: 'Lettuce', qty: 1 }],
      purchases: [{ purchaseDate: '2026-07-01', item: 'Lettuce', qty: 10 }],
      inventory: [],
    })

    expect(result.recommendations[0].financialImpact).toBeNull()
    expect(result.recommendations[0].evidence.calculations).toContain(
      'financial impact unavailable because no unit cost was provided',
    )
  })
})
