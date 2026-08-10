import { and, asc, eq, or } from 'drizzle-orm'

import {
  buildDashboardRecommendations,
  getDashboardRecommendations,
} from './dashboard-recommendations'
import type { PortfolioContextBundle } from './context-bundle'
import { getLatestSuccessfulMetricRun } from './precompute'
import type { RecommendationRecord } from './recommendations'
import { buildWalletImpactSummary, type WalletValue } from './wallet'
import {
  buildLocationComparison,
  spoilageRateFromTotals,
  type LocationComparison,
  type LocationComparisonInput,
} from './location-comparison'

export type PortfolioLocationInput = {
  locationId: string
  locationName: string
  metricStatus: 'ready' | 'no-completed-run'
  moneyAtRisk: WalletValue
  recommendations: readonly RecommendationRecord[]
  computedAt: Date | null
}

export type PortfolioLocationSummary = {
  locationId: string
  locationName: string
  metricStatus: PortfolioLocationInput['metricStatus']
  moneyAtRisk: WalletValue
  recommendationCount: number
  computedAt: string | null
}

export type PortfolioMoneyAtRisk = {
  status: 'calculated' | 'partial' | 'cannot-calculate'
  amount: string | null
  reason?: string
}

export type PortfolioRecommendation = RecommendationRecord & {
  locationId: string
  locationName: string
}

export type PortfolioRollup = {
  locationCount: number
  moneyAtRisk: PortfolioMoneyAtRisk
  locations: readonly PortfolioLocationSummary[]
  recommendations: readonly PortfolioRecommendation[]
}

export type PortfolioChatData = {
  contextBundle: PortfolioContextBundle
  estimatedTokens: number
  recommendations: readonly PortfolioRecommendation[]
  locationNames: readonly string[]
}

type Decimal = { coefficient: bigint; scale: number }

function parseDecimal(value: string): Decimal | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  return {
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function compareDecimals(left: string, right: string) {
  const leftValue = parseDecimal(left)
  const rightValue = parseDecimal(right)
  if (!leftValue || !rightValue) return null
  const scale = Math.max(leftValue.scale, rightValue.scale)
  const leftCoefficient =
    leftValue.coefficient * 10n ** BigInt(scale - leftValue.scale)
  const rightCoefficient =
    rightValue.coefficient * 10n ** BigInt(scale - rightValue.scale)
  return leftCoefficient === rightCoefficient
    ? 0
    : leftCoefficient > rightCoefficient
      ? 1
      : -1
}

function sumDecimalStrings(values: readonly string[]) {
  let coefficient = 0n
  let scale = 0
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    const nextScale = Math.max(scale, parsed.scale)
    coefficient =
      coefficient * 10n ** BigInt(nextScale - scale) +
      parsed.coefficient * 10n ** BigInt(nextScale - parsed.scale)
    scale = nextScale
  }

  if (coefficient === 0n) return '0'
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient).toString()
  if (scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(scale + 1, '0')
  const splitAt = padded.length - scale
  return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
}

function portfolioMoneyAtRisk(
  locations: readonly PortfolioLocationInput[],
): PortfolioMoneyAtRisk {
  const values = locations.flatMap(({ moneyAtRisk }) =>
    moneyAtRisk.status === 'calculated' && moneyAtRisk.amount !== null
      ? [moneyAtRisk.amount]
      : [],
  )
  if (values.length === 0) {
    return {
      status: 'cannot-calculate',
      amount: null,
      reason: 'No location has enough imported data for a dollar total yet.',
    }
  }

  const amount = sumDecimalStrings(values)
  if (amount === undefined) {
    return {
      status: 'cannot-calculate',
      amount: null,
      reason: 'The available location totals could not be reconciled.',
    }
  }

  if (values.length < locations.length) {
    return {
      status: 'partial',
      amount,
      reason: `${locations.length - values.length} location${locations.length - values.length === 1 ? '' : 's'} does not have a calculable dollar total.`,
    }
  }

  return { status: 'calculated', amount }
}

function rankPortfolioRecommendations(
  locations: readonly PortfolioLocationInput[],
) {
  return locations
    .flatMap(({ locationId, locationName, recommendations }) =>
      recommendations.map((recommendation) => ({
        ...recommendation,
        locationId,
        locationName,
      })),
    )
    .sort((left, right) => {
      const scoreOrder = compareDecimals(right.score, left.score)
      if (scoreOrder !== null && scoreOrder !== 0) return scoreOrder
      if (scoreOrder === null) {
        const fallback = left.score.localeCompare(right.score)
        if (fallback !== 0) return fallback
      }
      const locationOrder = left.locationName.localeCompare(right.locationName)
      if (locationOrder !== 0) return locationOrder
      return left.itemId.localeCompare(right.itemId)
    })
    .slice(0, 5)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }))
}

export function buildPortfolioRollup(
  locations: readonly PortfolioLocationInput[],
): PortfolioRollup {
  return {
    locationCount: locations.length,
    moneyAtRisk: portfolioMoneyAtRisk(locations),
    locations: locations.map((location) => ({
      locationId: location.locationId,
      locationName: location.locationName,
      metricStatus: location.metricStatus,
      moneyAtRisk: location.moneyAtRisk,
      recommendationCount: location.recommendations.length,
      computedAt: location.computedAt?.toISOString() ?? null,
    })),
    recommendations: rankPortfolioRecommendations(locations),
  }
}

const recommendationKeys = [
  'recommendation',
  'recommendation:margin-erosion',
  'recommendation:recipe-variance',
  'recommendation:ingredient-cost-increase',
] as const

/** Reads every active location through the account-owned location list. */
export async function getPortfolioRollup(headers: Headers) {
  const { db } = await import('@/src/server/db/client')
  const { listLocations } = await import('@/src/server/locations/locations')
  const { metricResults, metricRollups } =
    await import('@/src/server/db/schema')
  const ownedLocations = (await listLocations(headers)).filter(
    (location) => location.isActive,
  )

  const inputs = await Promise.all(
    ownedLocations.map(async (location) => {
      const run = await getLatestSuccessfulMetricRun(location.id)
      if (!run) {
        return {
          locationId: location.id,
          locationName: location.name,
          metricStatus: 'no-completed-run' as const,
          moneyAtRisk: {
            status: 'cannot-calculate' as const,
            amount: null,
            reason: 'No completed metric run exists for this location yet.',
          },
          recommendations: [],
          computedAt: null,
        }
      }

      const [impactRows, recommendationRows] = await Promise.all([
        db
          .select({ result: metricRollups.result })
          .from(metricRollups)
          .where(
            and(
              eq(metricRollups.locationId, location.id),
              eq(metricRollups.runId, run.id),
              eq(metricRollups.metricKey, 'impact'),
            ),
          )
          .limit(1),
        db
          .select({
            itemId: metricResults.inventoryItemId,
            result: metricResults.result,
          })
          .from(metricResults)
          .where(
            and(
              eq(metricResults.locationId, location.id),
              eq(metricResults.runId, run.id),
              or(
                ...recommendationKeys.map((key) =>
                  eq(metricResults.metricKey, key),
                ),
              ),
              eq(metricResults.status, 'calculated'),
            ),
          )
          .orderBy(asc(metricResults.inventoryItemId)),
      ])

      const wallet = buildWalletImpactSummary({
        impact: impactRows[0]?.result ?? null,
        margin: undefined,
        computedAt: run.completedAt ?? run.startedAt,
      })

      return {
        locationId: location.id,
        locationName: location.name,
        metricStatus: 'ready' as const,
        moneyAtRisk: wallet.moneyAtRisk,
        recommendations: buildDashboardRecommendations(recommendationRows),
        computedAt: run.completedAt ?? run.startedAt,
      }
    }),
  )

  return buildPortfolioRollup(inputs)
}

/** Loads the same owner-scoped locations for cross-location narration. */
export async function getPortfolioChatData(
  headers: Headers,
): Promise<PortfolioChatData | null> {
  const { listLocations } = await import('@/src/server/locations/locations')
  const locations = (await listLocations(headers)).filter(
    (location) => location.isActive,
  )
  const { loadOwnedPortfolioContextBundle } = await import('./context-bundle')
  const context = await loadOwnedPortfolioContextBundle(headers)
  if (!context) return null

  const contextLocationIds = new Set(
    context.bundle.locations.map(({ location }) => location.id),
  )
  const recommendationGroups = await Promise.all(
    locations
      .filter((location) => contextLocationIds.has(location.id))
      .map(async (location) => ({
        location,
        recommendations: await getDashboardRecommendations(
          headers,
          location.id,
        ),
      })),
  )

  return {
    contextBundle: context.bundle,
    estimatedTokens: context.estimatedTokens,
    locationNames: context.bundle.locations.map(
      ({ location }) => location.name,
    ),
    recommendations: recommendationGroups.flatMap(
      ({ location, recommendations }) =>
        recommendations.map((recommendation) => ({
          ...recommendation,
          locationId: location.id,
          locationName: location.name,
        })),
    ),
  }
}

function persistedResultInputs(result: unknown) {
  if (typeof result !== 'object' || result === null) return {}
  const inputs = (result as { inputs?: unknown }).inputs
  if (typeof inputs !== 'object' || inputs === null) return {}
  return inputs as Record<string, unknown>
}

function persistedMetricValue(
  rows: readonly {
    metricKey: string
    status: string
    value: string | null
    result: unknown
  }[],
  metricKey: string,
) {
  const row = rows.find((candidate) => candidate.metricKey === metricKey)
  return row?.status === 'calculated' ? (row.value ?? null) : null
}

/** Reads the latest owner-scoped runs and compares only identical run windows. */
export async function getPortfolioLocationComparison(
  headers: Headers,
): Promise<LocationComparison> {
  const { db } = await import('@/src/server/db/client')
  const { listLocations } = await import('@/src/server/locations/locations')
  const { metricRollups } = await import('@/src/server/db/schema')
  const ownedLocations = (await listLocations(headers)).filter(
    (location) => location.isActive,
  )

  const inputs = await Promise.all(
    ownedLocations.map(async (location): Promise<LocationComparisonInput> => {
      const run = await getLatestSuccessfulMetricRun(location.id)
      if (!run) {
        return {
          locationId: location.id,
          locationName: location.name,
          period: null,
          dataSufficiency: { status: 'cannot-calculate', value: null },
          metrics: {
            spoilageRate: null,
            margin: null,
            sellThrough: null,
            moneyAtRisk: null,
          },
        }
      }

      const rows = await db
        .select({
          metricKey: metricRollups.metricKey,
          status: metricRollups.status,
          value: metricRollups.value,
          result: metricRollups.result,
        })
        .from(metricRollups)
        .where(
          and(
            eq(metricRollups.locationId, location.id),
            eq(metricRollups.runId, run.id),
          ),
        )

      const spoilageRow = rows.find(
        (row) => row.metricKey === 'spoilageEstimate',
      )
      const orderedQuantity = persistedResultInputs(
        spoilageRow?.result,
      ).orderedQuantity
      const impactRow = rows.find((row) => row.metricKey === 'impact')
      const wallet = buildWalletImpactSummary({
        impact: impactRow?.result ?? null,
        margin: undefined,
        computedAt: run.completedAt ?? run.startedAt,
      })
      const dataSufficiency = persistedMetricValue(rows, 'dataSufficiency')

      return {
        locationId: location.id,
        locationName: location.name,
        period: {
          start: run.inputWindowStart.toISOString(),
          end: run.inputWindowEnd.toISOString(),
        },
        dataSufficiency: {
          status: dataSufficiency === null ? 'cannot-calculate' : 'calculated',
          value: dataSufficiency,
        },
        metrics: {
          spoilageRate: spoilageRateFromTotals(
            spoilageRow?.status === 'calculated'
              ? (spoilageRow.value ?? null)
              : null,
            typeof orderedQuantity === 'string' ? orderedQuantity : null,
          ),
          margin: persistedMetricValue(rows, 'margin'),
          sellThrough: persistedMetricValue(rows, 'sellThrough'),
          moneyAtRisk:
            wallet.moneyAtRisk.status === 'calculated'
              ? wallet.moneyAtRisk.amount
              : null,
        },
      }
    }),
  )

  return buildLocationComparison(inputs)
}
