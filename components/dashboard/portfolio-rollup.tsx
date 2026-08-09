import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecommendationCard } from './recommendation-card'
import type { PortfolioRollup } from '@/src/server/metrics/portfolio'

function totalLabel(rollup: PortfolioRollup) {
  if (rollup.moneyAtRisk.status === 'cannot-calculate') return 'Not available'
  return `$${rollup.moneyAtRisk.amount}`
}

function metricStatusLabel(status: 'ready' | 'no-completed-run') {
  return status === 'ready' ? 'Ready' : 'Waiting for data'
}

function locationMoneyLabel(
  value: PortfolioRollup['locations'][number]['moneyAtRisk'],
) {
  return value.status === 'calculated' && value.amount !== null
    ? `$${value.amount}`
    : 'Not available'
}

export function PortfolioRollupView({ rollup }: { rollup: PortfolioRollup }) {
  return (
    <>
      <section
        className="portfolio-summary"
        aria-labelledby="portfolio-summary-title"
      >
        <div className="portfolio-summary__heading">
          <div>
            <p className="app-page__eyebrow">Portfolio view</p>
            <h2 id="portfolio-summary-title">
              Money at risk across your locations
            </h2>
          </div>
          <p className="app-page__help">
            This total adds the latest completed metric run from each location.
          </p>
        </div>
        <Card className="portfolio-summary__card">
          <CardHeader>
            <CardTitle>Money at risk if trends continue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="portfolio-summary__total figure">
              {totalLabel(rollup)}
            </p>
            <p className="portfolio-summary__note">
              {rollup.moneyAtRisk.reason ??
                `Reconciled across ${rollup.locationCount} location${rollup.locationCount === 1 ? '' : 's'}.`}
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        className="portfolio-locations"
        aria-labelledby="portfolio-locations-title"
      >
        <div className="portfolio-section-heading">
          <div>
            <p className="app-page__eyebrow">Location summary</p>
            <h2 id="portfolio-locations-title">
              Open a location to investigate
            </h2>
          </div>
          <p className="app-page__help">
            Each row keeps its own scope and data status visible.
          </p>
        </div>
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <caption className="sr-only">Portfolio location summary</caption>
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">Money at risk</th>
                <th scope="col">Recommendations</th>
                <th scope="col">Data status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rollup.locations.map((location) => (
                <tr key={location.locationId}>
                  <th scope="row">{location.locationName}</th>
                  <td className="figure">
                    {locationMoneyLabel(location.moneyAtRisk)}
                  </td>
                  <td>{location.recommendationCount}</td>
                  <td>
                    <Badge variant="outline">
                      {metricStatusLabel(location.metricStatus)}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      className="portfolio-table__link"
                      href={`/dashboard?locationId=${encodeURIComponent(location.locationId)}`}
                    >
                      Open dashboard
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rollup.recommendations.length > 0 ? (
        <section
          className="portfolio-recommendations"
          aria-labelledby="portfolio-recommendations-title"
        >
          <div className="portfolio-section-heading">
            <div>
              <p className="app-page__eyebrow">Ranked across locations</p>
              <h2 id="portfolio-recommendations-title">
                What needs attention first?
              </h2>
            </div>
            <p className="app-page__help">
              The same recommendation score ranks every location. The location
              is named on every card.
            </p>
          </div>
          <div className="recommendation-list__cards">
            {rollup.recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.evidenceTraceRef.key}
                locationId={recommendation.locationId}
                locationName={recommendation.locationName}
                recommendation={recommendation}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
