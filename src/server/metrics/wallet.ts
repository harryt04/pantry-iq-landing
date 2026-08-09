import { and, eq } from 'drizzle-orm'

import type { TrendSummary } from './trends'
import { getLatestSuccessfulMetricRun } from './precompute'

type WalletCategory = {
  status: 'calculated' | 'suppressed'
  value: string | null
  scoreBasis: 'dollars' | 'units' | 'none'
  reason?: string
}

type WalletImpactResult = {
  categories: Record<string, WalletCategory>
  dollarsAvailable: boolean
  dollarReason?: string
  reason?: string
}

export type WalletValue = {
  status: 'calculated' | 'cannot-calculate'
  amount: string | null
  reason?: string
}

export type WalletImpactSummary = {
  estimatedSpoilageThisWeek: WalletValue
  moneyAtRisk: WalletValue
  marginTrend: Pick<
    TrendSummary,
    | 'currentValue'
    | 'currentValueLabel'
    | 'direction'
    | 'directionLabel'
    | 'comparisonLabel'
  >
  computedAt: string | null
}

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const CATEGORY_KEYS = [
  'currentSpoilage',
  'historicalSpoilage',
  'overordering',
  'marginLoss',
] as const

function parseDecimal(value: string): Decimal | undefined {
  if (!DECIMAL_PATTERN.test(value)) return undefined
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  return {
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function decimalToString(decimal: Decimal) {
  if (decimal.coefficient === 0n) return '0'
  const negative = decimal.coefficient < 0n
  const digits = (
    negative ? -decimal.coefficient : decimal.coefficient
  ).toString()
  if (decimal.scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(decimal.scale + 1, '0')
  const splitAt = padded.length - decimal.scale
  return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
}

function sumDecimals(values: readonly string[]) {
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    const scale = Math.max(total.scale, parsed.scale)
    total = {
      coefficient:
        total.coefficient * 10n ** BigInt(scale - total.scale) +
        parsed.coefficient * 10n ** BigInt(scale - parsed.scale),
      scale,
    }
  }
  return decimalToString(total)
}

function isWalletImpactResult(value: unknown): value is WalletImpactResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as { categories?: unknown }
  return typeof result.categories === 'object' && result.categories !== null
}

function unavailable(reason: string): WalletValue {
  return { status: 'cannot-calculate', amount: null, reason }
}

function calculated(amount: string): WalletValue {
  return { status: 'calculated', amount }
}

function categoryDollarValues(result: WalletImpactResult) {
  return CATEGORY_KEYS.flatMap((key) => {
    const category = result.categories[key]
    return category?.status === 'calculated' &&
      category.scoreBasis === 'dollars' &&
      category.value !== null
      ? [category.value]
      : []
  })
}

export function buildWalletImpactSummary(input: {
  impact: unknown
  margin:
    | Pick<
        TrendSummary,
        | 'currentValue'
        | 'currentValueLabel'
        | 'direction'
        | 'directionLabel'
        | 'comparisonLabel'
      >
    | undefined
  computedAt: Date | null
}): WalletImpactSummary {
  const margin = input.margin
  const marginTrend = {
    currentValue: margin?.currentValue ?? null,
    currentValueLabel: margin?.currentValueLabel ?? 'Not enough data',
    direction: margin?.direction ?? ('unknown' as const),
    directionLabel: margin?.directionLabel ?? 'No comparison',
    comparisonLabel:
      margin?.comparisonLabel ?? 'Margin needs more imported data.',
  }

  if (!isWalletImpactResult(input.impact)) {
    const reason =
      'I can’t calculate wallet impact until a metric run finishes.'
    return {
      estimatedSpoilageThisWeek: unavailable(reason),
      moneyAtRisk: unavailable(reason),
      marginTrend,
      computedAt: input.computedAt?.toISOString() ?? null,
    }
  }

  const current = input.impact.categories.currentSpoilage
  const estimatedSpoilage =
    current?.status === 'calculated' &&
    current.scoreBasis === 'dollars' &&
    current.value !== null
      ? calculated(current.value)
      : unavailable(
          current?.reason ??
            input.impact.dollarReason ??
            'I need on-hand quantity and unit cost to estimate spoilage.',
        )

  const values = categoryDollarValues(input.impact)
  const total = values.length > 0 ? sumDecimals(values) : undefined
  const moneyAtRisk =
    total === undefined
      ? unavailable(
          input.impact.dollarReason ??
            'I need unit costs before I can show a dollar amount at risk.',
        )
      : calculated(total)

  return {
    estimatedSpoilageThisWeek: estimatedSpoilage,
    moneyAtRisk,
    marginTrend,
    computedAt: input.computedAt?.toISOString() ?? null,
  }
}

/** Reads the latest successful, owner-scoped impact rollup for the dashboard. */
export async function getDashboardWalletImpact(
  headers: Headers,
  locationId: string,
  margin: TrendSummary | undefined,
) {
  const { requireOwnedLocation } =
    await import('@/src/server/auth/authorization')
  const { db } = await import('@/src/server/db/client')
  const { metricRollups } = await import('@/src/server/db/schema')
  const owned = await requireOwnedLocation(headers, locationId)
  const run = await getLatestSuccessfulMetricRun(owned.locationId)
  if (!run) {
    return buildWalletImpactSummary({
      impact: null,
      margin,
      computedAt: null,
    })
  }

  const [impact] = await db
    .select({ result: metricRollups.result })
    .from(metricRollups)
    .where(
      and(
        eq(metricRollups.locationId, owned.locationId),
        eq(metricRollups.runId, run.id),
        eq(metricRollups.metricKey, 'impact'),
      ),
    )
    .limit(1)

  return buildWalletImpactSummary({
    impact: impact?.result ?? null,
    margin,
    computedAt: run.completedAt ?? run.startedAt,
  })
}
