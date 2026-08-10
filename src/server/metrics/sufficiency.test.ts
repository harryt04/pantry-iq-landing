import { describe, expect, it } from 'vitest'

import {
  calculateDataSufficiency,
  DATA_SUFFICIENCY_DEFAULTS,
  type SufficiencyInput,
} from './sufficiency'

const day = (offset: number) => {
  const date = new Date('2026-01-01T12:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + offset)
  return date
}

function historyInput(weeks: number): SufficiencyInput {
  return {
    transactions: [{ transactedAt: day(0) }, { transactedAt: day(weeks * 7) }],
    purchaseOrders: [{ orderedAt: day(weeks * 7) }],
    inventorySnapshots: [{ countedAt: day(weeks * 7) }],
  }
}

describe('data sufficiency', () => {
  it.each([1, 3])(
    'suppresses predictive recommendations at %s weeks',
    (weeks) => {
      const result = calculateDataSufficiency(historyInput(weeks))

      expect(result.predictionEligible).toBe(false)
      expect(result.recommendationReadiness.predictiveReorder).toMatchObject({
        eligible: false,
      })
    },
  )

  it.each([4, 12])(
    'enables predictive recommendations at %s weeks',
    (weeks) => {
      const result = calculateDataSufficiency(historyInput(weeks))

      expect(result.predictionEligible).toBe(true)
      expect(result.recommendationReadiness.predictiveReorder).toMatchObject({
        eligible: true,
      })
    },
  )

  it('returns retrievable coverage components and readiness for each type', () => {
    const result = calculateDataSufficiency(historyInput(4))

    expect(result.value).toBe('71')
    expect(result.components).toEqual({
      history: '100',
      purchaseCompleteness: '50',
      inventoryPresence: '50',
      patternConsistency: '40',
    })
    expect(result.recommendationReadiness).toEqual({
      observedSellThrough: {
        eligible: true,
        reason: 'transaction history is available',
      },
      spoilageEstimate: {
        eligible: true,
        reason:
          'transactions, purchase orders, and inventory counts are available',
      },
      marginAnalysis: {
        eligible: true,
        reason: 'transactions and purchase orders are available',
      },
      trendAnalysis: {
        eligible: true,
        reason: 'at least two weeks of transaction history are available',
      },
      predictiveReorder: {
        eligible: true,
        reason: 'at least 4 weeks of transaction history are available',
      },
    })
  })

  it('keeps observations available with no history and makes the gap explicit', () => {
    const result = calculateDataSufficiency({
      transactions: [],
      purchaseOrders: [],
      inventorySnapshots: [],
    })

    expect(result.value).toBe('0')
    expect(result.dashboardEligible).toBe(false)
    expect(result.recommendationReadiness.observedSellThrough).toMatchObject({
      eligible: false,
      reason: 'requires at least one transaction',
    })
    expect(result.inputs.predictionHistoryWeeks).toBe(
      String(DATA_SUFFICIENCY_DEFAULTS.predictionHistoryWeeks),
    )
  })
})
