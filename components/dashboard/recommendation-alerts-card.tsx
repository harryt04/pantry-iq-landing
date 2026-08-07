'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Recommendation } from '@/lib/recommendations/engine'

interface RecommendationAlertsCardProps {
  recommendations: Recommendation[]
  walletImpact: number
  historyWeeks: number
  locationId?: string | null
  conversationId?: string | null
}

export function RecommendationAlertsCard({
  recommendations,
  walletImpact,
  historyWeeks,
  locationId,
  conversationId,
}: RecommendationAlertsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>What needs attention</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {walletImpact > 0
                ? `$${walletImpact.toFixed(2)} of estimated risk in the current data`
                : 'No dollar impact can be calculated from the current data'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {locationId && (
              <a
                href={`/api/export/${locationId}?type=recommendations`}
                className="text-muted-foreground text-sm font-medium hover:underline"
              >
                Export
              </a>
            )}
            {conversationId && (
              <Link
                href={`/conversations/${conversationId}`}
                className="text-primary inline-flex items-center gap-1 text-sm font-medium"
              >
                Investigate <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm">
            <Info className="h-4 w-4 shrink-0" />
            Import sales, purchasing, or inventory data to generate grounded
            recommendations.
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((recommendation) => (
              <article
                key={`${recommendation.item}-${recommendation.type}`}
                className="rounded-lg border p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{recommendation.item}</h3>
                    <p className="mt-1 text-sm">{recommendation.observation}</p>
                    {recommendation.financialImpact != null && (
                      <p className="mt-1 text-sm font-medium">
                        Estimated risk: $
                        {recommendation.financialImpact.toFixed(2)}
                      </p>
                    )}
                    {recommendation.prediction && (
                      <p className="text-muted-foreground mt-2 text-sm">
                        {recommendation.prediction}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-medium">
                      Suggested action: {recommendation.suggestedAction}
                    </p>
                    <details className="mt-3 text-sm">
                      <summary className="text-primary cursor-pointer font-medium">
                        Show your work
                      </summary>
                      <div className="text-muted-foreground bg-muted/40 mt-2 space-y-2 rounded-md p-3">
                        <p>
                          Sources:{' '}
                          {recommendation.evidence.sources.join(', ') || 'none'}
                        </p>
                        <ul className="list-inside list-disc space-y-1">
                          {recommendation.evidence.calculations.map(
                            (calculation) => (
                              <li key={calculation}>{calculation}</li>
                            ),
                          )}
                        </ul>
                        <p>
                          Data history: {historyWeeks.toFixed(1)} weeks. Scores
                          are ranking signals, not guarantees.
                        </p>
                        <ul className="list-inside list-disc space-y-1">
                          {recommendation.evidence.assumptions.map(
                            (assumption) => (
                              <li key={assumption}>{assumption}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
