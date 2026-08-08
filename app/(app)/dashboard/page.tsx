import Link from 'next/link'

import { TrendSummaries } from '@/components/dashboard/trend-summaries'
import { getDashboardTrends } from '@/src/server/metrics/trends'
import { headers } from 'next/headers'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const { locationId = '' } = await searchParams
  const summaries = locationId
    ? await getDashboardTrends(await headers(), locationId)
    : []

  return (
    <main className="app-page" aria-labelledby="dashboard-title">
      <p className="app-page__eyebrow">Dashboard</p>
      <h1 id="dashboard-title">Start with the data you already have.</h1>
      <p className="app-page__lede">
        Import a sales, purchasing, or inventory CSV for this location. The
        dashboard will show what the data can support once it has been checked.
      </p>
      <Link
        className="app-page__primary-action"
        href={`/import?locationId=${encodeURIComponent(locationId)}`}
      >
        Import data
      </Link>
      <TrendSummaries summaries={summaries} />
    </main>
  )
}
