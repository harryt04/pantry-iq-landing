import { eq } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { locations, transactions } from '@/src/server/db/schema'

import { businessDayBucket } from './definitions'
import { METRICS_CONFIG } from './config'

export type DashboardDataState = {
  status: 'empty' | 'insufficient' | 'ready'
  transactionDays: number
  requiredDays: number
  remainingDays: number
}

export type DashboardBusinessDayOptions = {
  timezone?: string
  boundary?: string
}

/**
 * Counts distinct restaurant business days, rather than calendar dates or
 * transaction rows. A late-night sale before the configured boundary belongs
 * to the previous service day.
 */
export function buildDashboardDataState(
  transactionDates: readonly (Date | string)[],
  requiredDays = METRICS_CONFIG.sufficiency.dashboardHistoryDays,
  options: DashboardBusinessDayOptions = {},
): DashboardDataState {
  const businessDays = new Set<string>()

  for (const timestamp of transactionDates) {
    const result = businessDayBucket({
      timestamp,
      timezone: options.timezone ?? 'UTC',
      boundary: options.boundary ?? '00:00:00',
    })
    if (result.status === 'calculated') businessDays.add(result.value)
  }

  const transactionDays = businessDays.size
  const remainingDays = Math.max(0, requiredDays - transactionDays)
  return {
    status:
      transactionDays === 0
        ? 'empty'
        : transactionDays < requiredDays
          ? 'insufficient'
          : 'ready',
    transactionDays,
    requiredDays,
    remainingDays,
  }
}

/** Reads the selected owner's transaction coverage for the dashboard gate. */
export async function getDashboardDataState(
  headers: Headers,
  locationId: string,
) {
  const owned = await requireOwnedLocation(headers, locationId)
  const [location, sales] = await Promise.all([
    db
      .select({
        timezone: locations.timezone,
        boundary: locations.businessDayBoundary,
      })
      .from(locations)
      .where(eq(locations.id, owned.locationId))
      .limit(1),
    db
      .select({ transactedAt: transactions.transactedAt })
      .from(transactions)
      .where(eq(transactions.locationId, owned.locationId)),
  ])

  const selectedLocation = location[0]
  if (!selectedLocation) {
    return buildDashboardDataState([])
  }

  return buildDashboardDataState(
    sales.map(({ transactedAt }) => transactedAt),
    undefined,
    {
      timezone: selectedLocation.timezone,
      boundary: selectedLocation.boundary,
    },
  )
}
