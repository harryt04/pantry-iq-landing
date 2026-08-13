import Link from 'next/link'
import { cookies, headers } from 'next/headers'

import { DashboardDataState } from '@/components/dashboard/dashboard-data-state'
import { TrendSummaries } from '@/components/dashboard/trend-summaries'
import { WalletImpactSummary } from '@/components/dashboard/wallet-impact-summary'
import { RecommendationCardList } from '@/components/dashboard/recommendation-card'
import { ItemDeepDives } from '@/components/dashboard/item-deep-dives'
import { ConnectionHealthNotice } from '@/components/dashboard/connection-health-notice'
import { getAppShellData } from '@/components/app/app-shell-server'
import { getDashboardDataState } from '@/src/server/metrics/dashboard-state'
import { getDashboardTrends } from '@/src/server/metrics/trends'
import { getDashboardWalletImpact } from '@/src/server/metrics/wallet'
import { getDashboardRecommendations } from '@/src/server/metrics/dashboard-recommendations'
import { listConnectorConnectionStatuses } from '@/src/server/connectors/framework'
import {
  buildItemDeepDiveGroups,
  getDashboardItemDeepDives,
} from '@/src/server/metrics/item-deep-dives'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>
}) {
  const params = await searchParams
  const shellData = await getAppShellData()
  const { initialLocationId } = shellData
  const locationId =
    params.locationId ??
    (await cookies()).get('pantryiq-location-id')?.value ??
    initialLocationId
  const locationName =
    shellData.locations.find((location) => location.id === locationId)?.name ??
    'This location'
  const requestHeaders = await headers()
  const [state, summaries, connections] = await Promise.all([
    getDashboardDataState(requestHeaders, locationId),
    getDashboardTrends(requestHeaders, locationId),
    listConnectorConnectionStatuses({
      headers: requestHeaders,
      locationId,
    }),
  ])
  const marginSummary = summaries.find((summary) => summary.id === 'margin')
  const wallet =
    state.status === 'ready'
      ? await getDashboardWalletImpact(
          requestHeaders,
          locationId,
          marginSummary,
        )
      : null
  const recommendations =
    state.status === 'ready'
      ? await getDashboardRecommendations(requestHeaders, locationId)
      : []
  const itemDeepDives =
    state.status === 'ready'
      ? await getDashboardItemDeepDives(requestHeaders, locationId)
      : []
  const dashboardHeading =
    state.status === 'empty'
      ? 'Start with the data you already have.'
      : state.status === 'insufficient'
        ? `${locationName}: more history needed.`
        : `${locationName}: ready for a closer look.`
  const dashboardLede =
    state.status === 'empty'
      ? 'Import a sales, purchasing, or inventory CSV for this location. The dashboard will show what the data can support once it has been checked.'
      : state.status === 'insufficient'
        ? `This location has ${state.transactionDays} days of transaction history. Add more history to strengthen the patterns.`
        : 'The latest completed metric run is ready to review. Start with what is costing you money, then decide what to do next.'

  return (
    <main
      className="app-page app-page--dashboard"
      aria-labelledby="dashboard-title"
    >
      <p className="app-page__eyebrow">Dashboard</p>
      <h1 id="dashboard-title">{dashboardHeading}</h1>
      <p className="app-page__lede">{dashboardLede}</p>
      <ConnectionHealthNotice
        connections={connections}
        locationId={locationId}
      />
      {state.status === 'ready' && wallet ? (
        <>
          <WalletImpactSummary summary={wallet} />
          <Link
            className="app-page__secondary-action"
            href={`/import?locationId=${encodeURIComponent(locationId)}`}
          >
            Import more data
          </Link>
        </>
      ) : (
        <DashboardDataState locationId={locationId} state={state} />
      )}
      <div
        className={`dashboard-content-grid ${
          state.status === 'ready'
            ? ''
            : 'dashboard-content-grid--without-recommendations'
        }`}
      >
        {state.status === 'ready' ? (
          <div className="dashboard-content-grid__recommendations">
            <RecommendationCardList
              locationId={locationId}
              recommendations={recommendations}
            />
          </div>
        ) : null}
        <div className="dashboard-content-grid__trends">
          <TrendSummaries
            summaries={summaries}
            transactionDays={state.transactionDays}
          />
        </div>
        {state.status === 'ready' && itemDeepDives.length > 0 ? (
          <div className="dashboard-content-grid__items">
            <ItemDeepDives
              locationId={locationId}
              groups={buildItemDeepDiveGroups(itemDeepDives)}
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}
