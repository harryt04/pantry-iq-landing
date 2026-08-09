import { and, eq, gte } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import { laborShifts, locations, transactions } from '@/src/server/db/schema'

import {
  buildLaborEfficiencyMetrics,
  type LaborEfficiencyResult,
} from './labor-efficiency'

const LOOKBACK_DAYS = 365

/** Reads one owner's sales and labor rows for the staffing analysis. */
export async function getLaborEfficiency(
  headers: Headers,
  locationId: string,
): Promise<LaborEfficiencyResult> {
  const owned = await requireOwnedLocation(headers, locationId)
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [location, sales, labor] = await Promise.all([
    db
      .select({
        timezone: locations.timezone,
        businessDayBoundary: locations.businessDayBoundary,
      })
      .from(locations)
      .where(eq(locations.id, owned.locationId))
      .limit(1),
    db
      .select({
        transactedAt: transactions.transactedAt,
        revenue: transactions.totalRevenue,
        totalCost: transactions.totalCost,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.locationId, owned.locationId),
          gte(transactions.transactedAt, periodStart),
        ),
      ),
    db
      .select({
        id: laborShifts.id,
        shiftStart: laborShifts.shiftStart,
        shiftEnd: laborShifts.shiftEnd,
        role: laborShifts.role,
        scheduledHours: laborShifts.scheduledHours,
        actualHours: laborShifts.actualHours,
        laborCost: laborShifts.laborCost,
      })
      .from(laborShifts)
      .where(
        and(
          eq(laborShifts.locationId, owned.locationId),
          gte(laborShifts.shiftStart, periodStart),
        ),
      ),
  ])

  const selectedLocation = location[0]
  if (!selectedLocation) throw new Error('That location could not be loaded.')

  return buildLaborEfficiencyMetrics({
    timezone: selectedLocation.timezone,
    businessDayBoundary: selectedLocation.businessDayBoundary,
    sales,
    labor,
  })
}
