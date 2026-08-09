import Link from 'next/link'
import { cookies, headers } from 'next/headers'

import { DashboardDataState } from '@/components/dashboard/dashboard-data-state'
import { TrendSummaries } from '@/components/dashboard/trend-summaries'
import { getAppShellData } from '@/components/app/app-shell-server'
import { getDashboardDataState } from '@/src/server/metrics/dashboard-state'
import { getDashboardTrends } from '@/src/server/metrics/trends'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const params = await searchParams
  const { initialLocationId } = await getAppShellData()
  const locationId =
    params.locationId ??
    (await cookies()).get('pantryiq-location-id')?.value ??
    initialLocationId
  const requestHeaders = await headers()
  const [state, summaries] = await Promise.all([
    getDashboardDataState(requestHeaders, locationId),
    getDashboardTrends(requestHeaders, locationId),
  ])
  const hasEnoughData = state.status === 'ready'

  return (
    <main className="app-page" aria-labelledby="dashboard-title">
      <p className="app-page__eyebrow">Dashboard</p>
      <h1 id="dashboard-title">Start with the data you already have.</h1>
      <p className="app-page__lede">
        Import a sales, purchasing, or inventory CSV for this location. The
        dashboard will show what the data can support once it has been checked.
      </p>
      {hasEnoughData ? (
        <Link
          className="app-page__primary-action"
          href={`/import?locationId=${encodeURIComponent(locationId)}`}
        >
          Import data
        </Link>
      ) : (
        <DashboardDataState locationId={locationId} state={state} />
      )}
      <TrendSummaries summaries={summaries} />
    </main>
  )
}
