import { describe, expect, it } from 'vitest'

import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

import {
  checkAnswerFormat,
  formatDeclineAnswer,
  formatFivePartAnswer,
} from './answer-format'

const recommendation: RecommendationRecord = {
  version: 1,
  itemId: 'salmon',
  itemName: 'Salmon',
  rank: 1,
  score: '82',
  observation: {
    purchaseOrderCount: 3,
    quantityOrdered: '3',
    quantitySold: '0',
    sellThroughRate: '0',
    quantityOnHand: '2',
    unit: 'lb',
    scores: { impact: '90', urgency: '80', dataSufficiency: '75' },
  },
  financialImpact: {
    amount: '40',
    currency: 'USD',
    basis: 'currentSpoilage',
  },
  prediction: {
    type: 'reorder',
    outcome: 'unlikely-to-sell',
    basis: {
      source: 'transactions',
      historyWeeks: '5',
      minimumHistoryWeeks: '4',
    },
  },
  suggestedAction: {
    framing: 'consider',
    action: 'reduce-next-order-or-pull-from-menu',
    timeHorizon: 'this week',
  },
  dataFindings: [],
  evidenceTraceRef: {
    key: 'recommendation:salmon',
    itemId: 'salmon',
    inputWindowStart: '2026-07-01T00:00:00.000Z',
    inputWindowEnd: '2026-08-08T00:00:00.000Z',
  },
}

describe('chat answer format', () => {
  it('renders the deterministic record as five ordered, labelled parts', () => {
    const answer = formatFivePartAnswer([recommendation])

    expect(answer).toContain(
      'Observation: Salmon has about $40 at risk from current spoilage.',
    )
    expect(answer).toContain('Financial impact: About $40 at risk')
    expect(answer).toContain(
      'Prediction: Based on 5 weeks of transactions, the recent pattern suggests Salmon may not sell if reordered.',
    )
    expect(answer).toContain(
      'Recommendation: Consider reducing the next order or reviewing Salmon this week.',
    )
    expect(answer).toContain('Show your work: Ask to review the sources')
    expect(checkAnswerFormat(answer)).toEqual({
      accepted: true,
      reason: 'ordered-sections',
    })
    expect(
      checkAnswerFormat(
        formatFivePartAnswer([recommendation], 'Narration is unavailable.'),
      ),
    ).toEqual({ accepted: true, reason: 'ordered-sections' })
  })

  it('rejects a response that is grounded but does not follow the format', () => {
    expect(
      checkAnswerFormat('Salmon has $40 at risk. Consider reviewing it.'),
    ).toEqual({ accepted: false, reason: 'ordered-sections' })
  })

  it('rejects confidence language in observations', () => {
    const response = [
      'Observation: Salmon has $40 at risk with 80% confidence. Consider reviewing Salmon.',
      'Financial impact: About $40 at risk.',
      'Prediction: Based on 5 weeks of transactions, the pattern may continue.',
      'Recommendation: Consider reviewing Salmon this week.',
      'Show your work: Ask to review the sources.',
    ].join('\n')

    expect(checkAnswerFormat(response)).toEqual({
      accepted: false,
      reason: 'observation-confidence',
    })
  })

  it('formats a decline with a concrete alternative and no figure', () => {
    const answer = formatDeclineAnswer(
      'Which item should I review for current spoilage risk?',
    )

    expect(checkAnswerFormat(answer)).toEqual({
      accepted: true,
      reason: 'ordered-sections',
    })
    expect(answer).not.toMatch(/\$\s*\d|\b\d+(?:\.\d+)?%?\b/)
    expect(answer).toContain(
      'Recommendation: Consider asking, "Which item should I review for current spoilage risk?"',
    )
  })
})
