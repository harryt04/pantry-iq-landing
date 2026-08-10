import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

import { ChatAnswer, parseChatAnswer } from './chat-primitives'

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
  evidenceTrace: {
    version: 1,
    sources: [
      {
        filename: 'sales.csv',
        source: 'transactions',
        rowCount: 4,
        uploadedAt: '2026-08-08T10:00:00.000Z',
      },
    ],
    calculations: [
      {
        id: 'metric:sellThrough',
        operator: 'qtySold / qtyOrdered × 100',
        inputs: { qtySold: '0', qtyOrdered: '3' },
        units: { result: '%' },
        result: '0',
      },
    ],
    assumptions: [
      {
        name: 'item.shelfLifeDays',
        value: '3',
        origin: 'system-default',
        editPath: 'Settings → Item master → shelf life',
      },
    ],
  },
}

const answer = [
  'Observation: Salmon has about $40 at risk. Consider reviewing Salmon.',
  'Financial impact: About $40 at risk from current spoilage.',
  'Prediction: Based on 5 weeks of transactions, Salmon may not sell if reordered.',
  'Recommendation: Consider reviewing Salmon this week.',
  'Show your work: Ask to review the sources, calculations, and assumptions.',
].join('\n')

describe('chat answer disclosure', () => {
  it('parses the five validated sections in order', () => {
    expect(parseChatAnswer(answer)).toEqual([
      {
        label: 'Observation',
        content: 'Salmon has about $40 at risk. Consider reviewing Salmon.',
      },
      {
        label: 'Financial impact',
        content: 'About $40 at risk from current spoilage.',
      },
      {
        label: 'Prediction',
        content:
          'Based on 5 weeks of transactions, Salmon may not sell if reordered.',
      },
      {
        label: 'Recommendation',
        content: 'Consider reviewing Salmon this week.',
      },
      {
        label: 'Show your work',
        content: 'Ask to review the sources, calculations, and assumptions.',
      },
    ])
  })

  it('reuses the recommendation trace and keeps the work collapsed', () => {
    const markup = renderToStaticMarkup(
      <ChatAnswer
        content={answer}
        locationId="location-1"
        recommendations={[recommendation]}
      />,
    )

    expect(markup).toContain('<h3>Observation</h3>')
    expect(markup).toContain('<h3>Show your work</h3>')
    expect(markup).toContain('Show your work')
    expect(markup).toContain('data-state="closed"')
    expect(markup).not.toContain('qtySold / qtyOrdered × 100')
  })

  it('flags a claim with no matching or complete trace', () => {
    const unmatched = renderToStaticMarkup(
      <ChatAnswer
        content={answer.replaceAll('Salmon', 'Beans')}
        locationId="location-1"
        recommendations={[recommendation]}
      />,
    )
    expect(unmatched).toContain('Output unverified')

    const { evidenceTrace: _trace, ...incompleteRecommendation } =
      recommendation
    const incomplete = renderToStaticMarkup(
      <ChatAnswer
        content={answer}
        locationId="location-1"
        recommendations={[incompleteRecommendation]}
      />,
    )
    expect(incomplete).toContain('Output unverified')
  })
})
