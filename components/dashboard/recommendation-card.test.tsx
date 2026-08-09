import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  RecommendationCard,
  recommendationSeverity,
} from './recommendation-card'
import { RecommendationWork } from './recommendation-work'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

const baseRecommendation: RecommendationRecord = {
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
      historyWeeks: '4',
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
    inputWindowStart: '2026-01-01T00:00:00.000Z',
    inputWindowEnd: '2026-01-31T00:00:00.000Z',
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

describe('recommendation card', () => {
  it('uses glyph and word severity that survive grayscale', () => {
    expect(recommendationSeverity('82')).toBe('risk')
    expect(recommendationSeverity('55')).toBe('watch')
    expect(recommendationSeverity('12')).toBe('steady')

    const markup = renderToStaticMarkup(
      <RecommendationCard
        locationId="location-1"
        recommendation={baseRecommendation}
      />,
    )

    expect(markup).toContain('▲')
    expect(markup).toContain('At risk')
    expect(markup).toContain('Observed:')
    expect(markup).toContain('Prediction:')
    expect(markup).toContain('Consider reducing')
    expect(markup).toContain('Show your work')
    expect(markup).toContain('Ask about this')
    const openWorkMarkup = renderToStaticMarkup(
      <RecommendationWork
        defaultOpen
        locationId="location-1"
        trace={baseRecommendation.evidenceTrace}
      />,
    )
    expect(openWorkMarkup).toContain('qtySold / qtyOrdered × 100')
    expect(openWorkMarkup).toContain('Edit in item settings')
  })

  it('opens the evidence and removes app-only actions in the marketing variant', () => {
    const markup = renderToStaticMarkup(
      <RecommendationCard
        locationId="marketing-proof"
        recommendation={baseRecommendation}
        variant="marketing"
      />,
    )

    expect(markup).toContain('data-variant="marketing"')
    expect(markup).toContain('data-state="open"')
    expect(markup).toContain('qtySold / qtyOrdered × 100')
    expect(markup).toContain('Change in item settings')
    expect(markup).not.toContain('Ask about this')
    expect(markup).not.toContain('/settings?locationId=marketing-proof')
  })

  it('keeps short-history recommendations explicitly observational', () => {
    const { prediction: _prediction, ...shortHistoryRecommendation } =
      baseRecommendation
    const markup = renderToStaticMarkup(
      <RecommendationCard
        locationId="location-1"
        recommendation={shortHistoryRecommendation}
      />,
    )

    expect(markup).toContain('Observation only:')
    expect(markup).not.toContain('Prediction:')
  })

  it('marks a recommendation unverified when its trace is incomplete', () => {
    const markup = renderToStaticMarkup(
      <RecommendationCard
        locationId="location-1"
        recommendation={{
          ...baseRecommendation,
          evidenceTrace: {
            version: 1,
            sources: [],
            calculations: [],
            assumptions: [],
          },
        }}
      />,
    )

    expect(markup).toContain('Output unverified')
    expect(markup).not.toContain('Show your work')
  })

  it('marks a recommendation unverified when its trace is missing', () => {
    const { evidenceTrace: _trace, ...recommendationWithoutTrace } =
      baseRecommendation
    const markup = renderToStaticMarkup(
      <RecommendationCard
        locationId="location-1"
        recommendation={recommendationWithoutTrace}
      />,
    )

    expect(markup).toContain('Output unverified')
    expect(markup).not.toContain('Show your work')
  })
})
