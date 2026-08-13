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
  const { initialLocationId } = await getAppShellData()
  const locationId =
    params.locationId ??
    (await cookies()).get('pantryiq-location-id')?.value ??
    initialLocationId
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

  return (
    <main
      className="app-page app-page--dashboard"
      aria-labelledby="dashboard-title"
    >
      <p className="app-page__eyebrow">Dashboard</p>
      <h1 id="dashboard-title">Start with the data you already have.</h1>
      <p className="app-page__lede">
        Import a sales, purchasing, or inventory CSV for this location. The
        dashboard will show what the data can support once it has been checked.
      </p>
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
      {state.status === 'ready' ? (
        <RecommendationCardList
          locationId={locationId}
          recommendations={recommendations}
        />
      ) : null}
      <TrendSummaries summaries={summaries} />
      {state.status === 'ready' && itemDeepDives.length > 0 ? (
        <ItemDeepDives
          locationId={locationId}
          groups={buildItemDeepDiveGroups(itemDeepDives)}
        />
      ) : null}
    </main>
  )
}
