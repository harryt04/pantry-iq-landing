import { and, eq, gte, lte } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  externalSignals,
  laborShifts,
  locations,
  transactions,
} from '@/src/server/db/schema'

import {
  buildLaborEfficiencyMetrics,
  type LaborEfficiencyResult,
} from './labor-efficiency'
import {
  buildDemandForecast,
  type DemandForecastResult,
} from './demand-forecast'

const LOOKBACK_DAYS = 365

/** Reads one owner's sales and labor rows for the staffing analysis. */
export async function getLaborEfficiency(
  headers: Headers,
  locationId: string,
): Promise<LaborEfficiencyResult & { forecast: DemandForecastResult }> {
  const owned = await requireOwnedLocation(headers, locationId)
  const periodStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const signalWindowEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const [location, sales, labor, signalRows] = await Promise.all([
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
        qty: transactions.qty,
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
    db
      .select({
        id: externalSignals.id,
        kind: externalSignals.kind,
        source: externalSignals.source,
        externalId: externalSignals.externalId,
        businessDate: externalSignals.businessDate,
        status: externalSignals.status,
        feature: externalSignals.feature,
        condition: externalSignals.condition,
        value: externalSignals.value,
        retrievedAt: externalSignals.retrievedAt,
        validFrom: externalSignals.validFrom,
        validTo: externalSignals.validTo,
        sourceUrl: externalSignals.sourceUrl,
      })
      .from(externalSignals)
      .where(
        and(
          eq(externalSignals.locationId, owned.locationId),
          gte(externalSignals.validTo, periodStart),
          lte(externalSignals.validFrom, signalWindowEnd),
        ),
      ),
  ])

  const selectedLocation = location[0]
  if (!selectedLocation) throw new Error('That location could not be loaded.')

  const efficiency = buildLaborEfficiencyMetrics({
    timezone: selectedLocation.timezone,
    businessDayBoundary: selectedLocation.businessDayBoundary,
    sales: sales.map(({ transactedAt, revenue, totalCost }) => ({
      transactedAt,
      revenue,
      totalCost,
    })),
    labor,
  })
  return {
    ...efficiency,
    forecast: buildDemandForecast({
      timezone: selectedLocation.timezone,
      businessDayBoundary: selectedLocation.businessDayBoundary,
      sales,
      externalSignals: signalRows.map((signal) => ({
        ...signal,
        kind: signal.kind as 'weather' | 'event',
        status: signal.status as 'observed' | 'forecast',
        value: signal.value,
      })),
    }),
  }
}
