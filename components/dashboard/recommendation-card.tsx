import * as React from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecommendationWork } from './recommendation-work'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

type RecommendationSeverity = 'steady' | 'watch' | 'risk'

export type RecommendationCardVariant = 'dashboard' | 'chat' | 'marketing'

export function recommendationSeverity(score: string): RecommendationSeverity {
  const numericScore = Number(score)
  if (Number.isFinite(numericScore) && numericScore >= 70) return 'risk'
  if (Number.isFinite(numericScore) && numericScore >= 40) return 'watch'
  return 'steady'
}

function severityLabel(severity: RecommendationSeverity) {
  if (severity === 'risk') return { label: 'At risk', glyph: '▲' }
  if (severity === 'watch') return { label: 'Watch', glyph: '◆' }
  return { label: 'Steady', glyph: '●' }
}

function impactLabel(basis: RecommendationRecord['financialImpact']['basis']) {
  if (basis === 'currentSpoilage') return 'current spoilage'
  if (basis === 'historicalSpoilage') return 'historical spoilage'
  if (basis === 'overordering') return 'overordering'
  if (basis === 'marginLoss') return 'margin loss'
  return 'the available data'
}

/**
 * The engine keeps ratios at six decimal places so the evidence trace stays
 * exact. A sentence is not the trace — "8.333333% sell-through" reads as a
 * glitch, so the prose rounds and the trace keeps the full value.
 */
function displayPercent(rate: string) {
  const numeric = Number(rate)
  if (!Number.isFinite(numeric)) return rate
  return `${Number(numeric.toFixed(1))}`
}

function observationSentence(recommendation: RecommendationRecord) {
  if (recommendation.menuFinding) {
    return `${recommendation.menuFinding.label}: ${recommendation.menuFinding.detail}`
  }
  const { observation } = recommendation
  if (
    observation.quantityOrdered !== null &&
    observation.quantitySold !== null &&
    observation.sellThroughRate !== null
  ) {
    return `Ordered ${observation.purchaseOrderCount} time${observation.purchaseOrderCount === 1 ? '' : 's'}, sold ${observation.quantitySold} ${observation.unit} (${displayPercent(observation.sellThroughRate)}% sell-through).`
  }
  return 'The imported data supports this item as a priority, but some quantities are unavailable.'
}

function impactSentence(recommendation: RecommendationRecord) {
  const impact = recommendation.financialImpact
  return impact.amount !== null
    ? `About $${impact.amount} at risk from ${impactLabel(impact.basis)}`
    : `Dollar impact is not available from ${impactLabel(impact.basis)}`
}

function predictionSentence(recommendation: RecommendationRecord) {
  const prediction = recommendation.prediction
  if (!prediction) return null
  const outcome =
    prediction.outcome === 'unlikely-to-sell'
      ? `it may not sell if you reorder ${recommendation.itemName}`
      : `the recent sales pattern may continue for ${recommendation.itemName}`
  return `Based on ${prediction.basis.historyWeeks} weeks of transactions, ${outcome}.`
}

function actionSentence(recommendation: RecommendationRecord) {
  if (
    recommendation.suggestedAction.action ===
    'reduce-next-order-or-pull-from-menu'
  ) {
    return `Consider reducing the next order or reviewing ${recommendation.itemName} this week.`
  }
  return `Consider reviewing ${recommendation.itemName} this week.`
}

export function RecommendationCard({
  locationId,
  locationName,
  recommendation,
  variant = 'dashboard',
  workDefaultOpen,
}: {
  locationId: string
  locationName?: string
  recommendation: RecommendationRecord
  variant?: RecommendationCardVariant
  workDefaultOpen?: boolean
}) {
  const severity = recommendationSeverity(recommendation.score)
  const severityInfo = severityLabel(severity)
  const prediction = predictionSentence(recommendation)

  return (
    <Card
      className={`recommendation-card recommendation-card--${severity} recommendation-card--${variant}`}
      data-severity={severity}
      data-variant={variant}
      id={`recommendation-${recommendation.itemId}`}
    >
      <CardHeader className="recommendation-card__header">
        <div>
          <p className="recommendation-card__rank figure">
            #{recommendation.rank}
          </p>
          <CardTitle>{recommendation.itemName}</CardTitle>
          {locationName ? (
            <p className="recommendation-card__location">{locationName}</p>
          ) : null}
        </div>
        <Badge className="recommendation-card__severity" variant="outline">
          <span aria-hidden="true">{severityInfo.glyph}</span>{' '}
          {severityInfo.label}
        </Badge>
      </CardHeader>
      <CardContent className="recommendation-card__content">
        <div className="recommendation-card__sentences">
          <p className="recommendation-card__impact">
            <strong>Financial impact:</strong> {impactSentence(recommendation)};{' '}
            <strong>Observed:</strong> {observationSentence(recommendation)}
          </p>
          {prediction ? (
            <p className="recommendation-card__prediction">
              <strong>Prediction:</strong> {prediction}
            </p>
          ) : (
            <p className="recommendation-card__observation-only">
              <strong>Observation only:</strong> This does not predict what will
              happen next.
            </p>
          )}
          <p className="recommendation-card__action">
            {actionSentence(recommendation)}
          </p>
        </div>
        <div className="recommendation-card__actions">
          {/* The full engine trace is an in-product audit tool. On the
              marketing page it renders as thousands of pixels of tuning
              constants, so that surface shows a curated receipt instead — see
              components/marketing/marketing-evidence.ts. */}
          {variant !== 'marketing' ? (
            <RecommendationWork
              locationId={locationId}
              trace={recommendation.evidenceTrace}
              defaultOpen={workDefaultOpen ?? false}
              showEditLinks
            />
          ) : null}
          {variant !== 'marketing' ? (
            <Button asChild size="sm" variant="secondary">
              <Link
                href={`/chat?locationId=${encodeURIComponent(locationId)}&itemId=${encodeURIComponent(recommendation.itemId)}`}
              >
                Ask about this
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecommendationCardList({
  locationId,
  locationName,
  recommendations,
  variant = 'dashboard',
}: {
  locationId: string
  locationName?: string
  recommendations: readonly RecommendationRecord[]
  variant?: RecommendationCardVariant
}) {
  if (recommendations.length === 0) return null

  return (
    <section
      aria-labelledby="recommendations-title"
      className="recommendation-list"
    >
      <div className="recommendation-list__heading">
        <div>
          <p className="app-page__eyebrow">Ranked recommendations</p>
          <h2 id="recommendations-title">What needs attention first?</h2>
        </div>
        <p className="app-page__help">
          These are suggestions from the latest completed metric run. You stay
          in control of what happens next.
        </p>
      </div>
      <div className="recommendation-list__cards">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.evidenceTraceRef.key}
            locationId={locationId}
            {...(locationName ? { locationName } : {})}
            recommendation={recommendation}
            variant={variant}
          />
        ))}
      </div>
    </section>
  )
}
