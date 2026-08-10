import { LineChart } from '@/components/charts/chart-primitives'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrendSummary } from '@/src/server/metrics/trends'

function directionGlyph(direction: TrendSummary['direction']) {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  if (direction === 'flat') return '→'
  return '—'
}

export function TrendSummaries({
  summaries,
}: {
  summaries: readonly TrendSummary[]
}) {
  if (summaries.length === 0) return null

  return (
    <section
      className="trend-summary-grid"
      aria-labelledby="trend-summary-title"
    >
      <div className="trend-summary-grid__heading">
        <div>
          <p className="app-page__eyebrow">Over time</p>
          <h2 id="trend-summary-title">What has changed lately?</h2>
        </div>
        <p className="app-page__help">
          Weekly views use imported rows only. A missing point means the data
          could not support that calculation.
        </p>
      </div>
      <div className="trend-summary-grid__cards">
        {summaries.map((summary) => (
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
        ))}
      </div>
    </section>
  )
}
