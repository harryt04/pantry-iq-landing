import { headers } from 'next/headers'

import { LocationComparisonView } from '@/components/dashboard/location-comparison'
import { PortfolioRollupView } from '@/components/dashboard/portfolio-rollup'
import {
  getPortfolioLocationComparison,
  getPortfolioRollup,
} from '@/src/server/metrics/portfolio'

export default async function PortfolioPage() {
  const requestHeaders = await headers()
  const [rollup, comparison] = await Promise.all([
    getPortfolioRollup(requestHeaders),
    getPortfolioLocationComparison(requestHeaders),
  ])

  return (
    <main className="app-page" aria-labelledby="portfolio-title">
      <p className="app-page__eyebrow">Portfolio</p>
      <h1 id="portfolio-title">
        See the whole business, then choose where to look.
      </h1>
      <p className="app-page__lede">
        This view combines only the locations owned by your account. It does not
        replace a location dashboard; it helps you decide which one to open.
      </p>
      <PortfolioRollupView rollup={rollup} />
      <LocationComparisonView comparison={comparison} />
    </main>
  )
}
