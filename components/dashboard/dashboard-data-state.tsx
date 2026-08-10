import Link from 'next/link'

import { Empty, EmptyContent, EmptyHeader } from '@/components/ui/empty'
import type { DashboardDataState } from '@/src/server/metrics/dashboard-state'

export function DashboardDataState({
  locationId,
  state,
}: {
  locationId: string
  state: DashboardDataState
}) {
  if (state.status === 'ready') return null

  const isEmpty = state.status === 'empty'
  const title = isEmpty
    ? 'Nothing to show yet.'
    : 'Your dashboard is taking shape.'
  const description = isEmpty
    ? `You have ${state.transactionDays} days of transaction data. Upload a week of sales data and I'll show you where the money's going.`
    : `I need about ${state.requiredDays} days of transactions before the numbers mean anything. You have ${state.transactionDays}. Add ${state.remainingDays} more days of history and the available trends will stay below.`

  return (
    <section
      className="dashboard-data-state"
      aria-labelledby="dashboard-data-state-title"
    >
      <Empty className="dashboard-data-state__empty">
        <EmptyHeader className="dashboard-data-state__header">
          <p className="app-page__eyebrow">Data check</p>
          <h2 id="dashboard-data-state-title">{title}</h2>
        </EmptyHeader>
        <EmptyContent className="dashboard-data-state__content">
          <p>{description}</p>
          <p
            className="dashboard-data-state__progress figure"
            aria-label={`${state.transactionDays} of ${state.requiredDays} transaction days available`}
          >
            {state.transactionDays} / {state.requiredDays} days
          </p>
          <Link
            className="app-page__primary-action"
            href={`/import?locationId=${encodeURIComponent(locationId)}`}
          >
            Import a CSV
          </Link>
        </EmptyContent>
      </Empty>
    </section>
  )
}
