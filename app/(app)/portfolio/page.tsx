import { headers } from 'next/headers'

import { PortfolioRollupView } from '@/components/dashboard/portfolio-rollup'
import { getPortfolioRollup } from '@/src/server/metrics/portfolio'

export default async function PortfolioPage() {
  const rollup = await getPortfolioRollup(await headers())

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
    </main>
  )
}
