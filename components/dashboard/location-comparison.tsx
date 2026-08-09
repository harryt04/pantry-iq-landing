import * as React from 'react'

import { RankedBarChart } from '@/components/charts/chart-primitives'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  LocationComparison,
  LocationComparisonMetric,
} from '@/src/server/metrics/location-comparison'

function periodLabel(comparison: LocationComparison) {
  if (!comparison.period) return null
  return `${comparison.period.start.slice(0, 10)} to ${comparison.period.end.slice(0, 10)}`
}

function ComparisonMetricCard({
  metric,
}: {
  metric: LocationComparisonMetric
}) {
  const chartData = metric.locations.flatMap((location) =>
    location.chartValue === null
      ? []
      : [
          {
            label: location.locationName,
            value: location.chartValue,
            valueLabel: location.valueLabel,
          },
        ],
  )

  return (
    <Card className="location-comparison-card">
      <CardHeader>
        <CardTitle>{metric.label}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <RankedBarChart
            ariaLabel={`${metric.label} by location`}
            data={chartData}
          />
        ) : (
          <p className="location-comparison-card__empty">
            No location has enough imported data for this comparison.
          </p>
        )}
        <ul className="location-comparison-card__values">
          {metric.locations.map((location) => (
            <li key={location.locationId}>
              <span>{location.locationName}</span>
              <span className="figure">{location.valueLabel}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function LocationComparisonView({
  comparison,
}: {
  comparison: LocationComparison
}) {
  return (
    <section
      className="location-comparison"
      aria-labelledby="location-comparison-title"
    >
      <div className="portfolio-section-heading">
        <div>
          <p className="app-page__eyebrow">Side by side</p>
          <h2 id="location-comparison-title">
            Compare locations on one period
          </h2>
        </div>
        <p className="app-page__help">
          Ranked bars show the same metric across locations. Every value is
          printed beside its mark.
        </p>
      </div>

      {comparison.status === 'no-data' ? (
        <Card>
          <CardContent>
            <p className="location-comparison-card__empty">
              Add a completed metric run to compare locations.
            </p>
          </CardContent>
        </Card>
      ) : comparison.status === 'period-mismatch' ? (
        <Card className="location-comparison-card location-comparison-card--warning">
          <CardHeader>
            <CardTitle>Locations cover different periods</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              PantryIQ is keeping this comparison hidden until every location
              has the same imported period.
            </p>
            <ul className="location-comparison-card__values">
              {comparison.locations.map((location) => (
                <li key={location.locationId}>
                  <span>{location.locationName}</span>
                  <Badge variant="outline">
                    {comparison.periodMismatchLocations.includes(
                      location.locationName,
                    )
                      ? 'Period differs'
                      : 'Period available'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={`location-comparison__coverage location-comparison__coverage--${comparison.coverage}`}
            role="status"
          >
            <strong>
              {comparison.coverage === 'varied'
                ? 'Data coverage differs across locations.'
                : 'Data coverage is comparable across locations.'}
            </strong>{' '}
            Read each location’s sufficiency score before acting on a ranking.
          </div>
          <p className="location-comparison__period">
            Same imported period:{' '}
            <span className="figure">{periodLabel(comparison)}</span>
          </p>
          <div className="location-comparison__locations">
            {comparison.locations.map((location) => (
              <Badge key={location.locationId} variant="outline">
                {location.locationName}: {location.dataSufficiencyLabel}
              </Badge>
            ))}
          </div>
          <div className="location-comparison__grid">
            {comparison.metrics.map((metric) => (
              <ComparisonMetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
