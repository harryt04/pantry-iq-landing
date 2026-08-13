import { LineChart } from '@/components/charts/chart-primitives'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrendSummary } from '@/src/server/metrics/trends'
import { METRICS_CONFIG } from '@/src/server/metrics/config'

function directionGlyph(direction: TrendSummary['direction']) {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  if (direction === 'flat') return '→'
  return '—'
}

export function TrendSummaries({
  summaries,
  transactionDays,
}: {
  summaries: readonly TrendSummary[]
  transactionDays?: number
}) {
  if (summaries.length === 0) return null

  const availableWeeks = (summary: TrendSummary) =>
    transactionDays === undefined
      ? new Set(
          summary.points
            .filter((point) => point.value !== null)
            .map((point) => point.label),
        ).size
      : Math.floor(transactionDays / 7)
  const requiredWeeks = METRICS_CONFIG.sufficiency.predictionHistoryWeeks

  return (
    <section
      className="trend-summary-grid"
      aria-labelledby="trend-summary-title"
    >
      <div className="trend-summary-grid__heading dashboard-section-heading--compact">
        <div>
          <h2 id="trend-summary-title">What has changed lately?</h2>
          <p className="app-page__qualifier">
            Weekly imported rows only; missing points mean the data could not
            support that calculation.
          </p>
        </div>
      </div>
      <div className="trend-summary-grid__cards">
        {summaries.map((summary) => {
          if (summary.currentValue === null) {
            return (
              <Card
                className="trend-summary-card trend-summary-card--missing"
                key={summary.id}
              >
                <CardContent>
                  <div className="trend-summary-card__missing-row">
                    <CardTitle>{summary.title}</CardTitle>
                    <div className="trend-summary-card__missing-meta">
                      <p className="trend-summary-card__coverage figure">
                        Needs {requiredWeeks} weeks · has{' '}
                        {availableWeeks(summary)} ·{' '}
                        {Math.max(0, requiredWeeks - availableWeeks(summary))}{' '}
                        more weeks needed
                      </p>
                      <p
                        className="trend-summary-card__missing-detail"
                        aria-label={`${summary.currentValueLabel}. ${summary.directionLabel}. ${summary.comparisonLabel}`}
                        title={summary.comparisonLabel}
                      >
                        {directionGlyph(summary.direction)}{' '}
                        {summary.directionLabel} · prior week unavailable.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card className="trend-summary-card" key={summary.id}>
              <CardHeader>
                <CardTitle>{summary.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="trend-summary-card__figure figure">
                  {summary.currentValueLabel}
                </p>
                <p
                  className="trend-summary-card__direction"
                  aria-label={`Direction: ${summary.directionLabel}`}
                >
                  <span aria-hidden="true">
                    {directionGlyph(summary.direction)}
                  </span>{' '}
                  {summary.directionLabel}
                </p>
                <p className="trend-summary-card__comparison">
                  {summary.comparisonLabel}
                </p>
                <LineChart
                  ariaLabel={`${summary.title} by week`}
                  series={[
                    {
                      id: summary.id,
                      label: summary.title,
                      points: summary.points.map((point) =>
                        point.chartValue === null
                          ? null
                          : {
                              label: point.label,
                              value: point.chartValue,
                              valueLabel: point.valueLabel,
                            },
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
