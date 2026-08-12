import { and, asc, desc, eq, sql } from 'drizzle-orm'

import {
  inventoryItems,
  inventorySnapshots,
  itemUnitConversions,
  csvUploadHistory,
  externalSignals,
  metricResults,
  metricRollups,
  metricRuns,
  laborShifts,
  locations,
  recipeCostHistory,
  recipeIngredients,
  recipes,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'

import {
  margin,
  sellThroughRate,
  spoilageRisk,
  variance,
  type MetricResult,
} from './definitions'
import {
  calculateImpact,
  rollupImpact,
  type LaborCostVarianceInput,
  type ImpactMetricResult,
} from './impact'
import { METRICS_CONFIG } from './config'
import {
  resolveSpoilage,
  type SpoilageResolution,
  type SpoilageResolutionResult,
} from './spoilage'
import {
  calculateDataSufficiency,
  DATA_SUFFICIENCY_METRIC,
} from './sufficiency'
import { calculateUrgency, rollupUrgency } from './urgency'
import {
  precomputedRankingCandidates,
  rankRecommendations,
  type RankedRecommendation,
} from './ranking'
import {
  assembleRecommendationRecords,
  recommendationMetricKey,
  type RecommendationRecord,
} from './recommendations'
import type { EvidenceSourceInput } from './evidence'
import {
  buildDemandForecast,
  type DemandForecastResult,
} from '@/src/server/staffing/demand-forecast'
import type { ExternalSignalInput } from '@/src/server/staffing/external-signals'
import {
  buildShiftRecommendations,
  type ShiftRecommendationInput,
} from '@/src/server/staffing/shift-recommendations'
import {
  assembleMenuRecommendationRecords,
  buildMenuRecommendationCandidates,
  type MenuRecommendationInput,
} from '@/src/server/menu/menu-recommendations'
import { buildUsageVariance } from '@/src/server/menu/usage-variance'
import {
  detectReconciliationConflicts,
  listReconciliationConflicts,
  mergeReconciliationDecisions,
  reconciliationTrace,
  shouldIncludeRecord,
  type ReconciliationConflict,
} from '@/src/server/ingestion/reconciliation'

export const PRECOMPUTED_METRICS = [
  'sellThrough',
  'spoilageEstimate',
  'spoilageRisk',
  'margin',
  'variance',
  DATA_SUFFICIENCY_METRIC,
  'impact',
  'urgency',
] as const

export type PrecomputedMetric =
  | (typeof PRECOMPUTED_METRICS)[number]
  | 'demandForecast'
  | 'staffingRecommendations'

type Decimal = { coefficient: bigint; scale: number }

export type PrecomputeItem = {
  id: string
  displayName?: string
  unit: string
  costPerUnit: string | null
  shelfLifeDays?: number | null
  itemType?: 'ingredient' | 'menu_item'
  menuPrice?: string | null
}

export type PrecomputeSale = {
  itemId: string | null
  qty: string
  revenue: string
  totalCost?: string | null
  transactedAt: Date
  source?: string
  externalId?: string | null
}

export type PrecomputeOrder = {
  itemId: string | null
  qty: string
  totalCost: string
  orderedAt: Date
  receivedAt?: Date | null
  source?: string
  externalId?: string | null
}

export type PrecomputeSnapshot = {
  itemId: string
  qty: string
  countedAt: Date
  source?: string
  externalId?: string | null
}

export type PrecomputeInput = {
  items: readonly PrecomputeItem[]
  sales: readonly PrecomputeSale[]
  orders: readonly PrecomputeOrder[]
  snapshots: readonly PrecomputeSnapshot[]
  labor?: ShiftRecommendationInput['labor']
  timezone?: string
  businessDayBoundary?: string
  sources?: readonly EvidenceSourceInput[]
  reconciliation?: readonly ReconciliationConflict[]
  menuRecommendations?: MenuRecommendationInput
  demandForecast?: DemandForecastResult
  externalSignals?: readonly ExternalSignalInput[]
}

export type StoredMetric = {
  metricKey: PrecomputedMetric
  status: MetricResult<string>['status']
  value: string | null
  result: MetricResult<string>
}

type SpoilageStoredMetric = StoredMetric & {
  result: StoredMetric['result'] & { resolution: SpoilageResolution }
}

export type PrecomputeOutput = {
  itemResults: Array<{
    itemId: string
    metrics: StoredMetric[]
  }>
  rollups: StoredMetric[]
  rankedItems: RankedRecommendation[]
  recommendations: RecommendationRecord[]
  staffingRecommendations: ReturnType<typeof buildShiftRecommendations>
  inputWindowStart: Date
  inputWindowEnd: Date
}

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const RATIO_SCALE = 6

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

function normalize(decimal: Decimal): Decimal {
  let coefficient = decimal.coefficient
  let scale = decimal.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function decimalToString(decimal: Decimal): string {
  const normalized = normalize(decimal)
  if (normalized.coefficient === 0n) return '0'
  const negative = normalized.coefficient < 0n
  const digits = (
    negative ? -normalized.coefficient : normalized.coefficient
  ).toString()
  if (normalized.scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(normalized.scale + 1, '0')
  const splitAt = padded.length - normalized.scale
  return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
}

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return normalize({
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  })
}

function sumDecimals(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function laborVarianceInput(
  labor: readonly NonNullable<PrecomputeInput['labor']>[number][],
): LaborCostVarianceInput | undefined {
  if (labor.length === 0) return undefined
  if (
    labor.some(
      (shift) =>
        shift.laborCost === null ||
        shift.actualHours === null ||
        shift.scheduledHours === null,
    )
  )
    return undefined

  const laborCost = sumDecimals(labor.map((shift) => shift.laborCost!))
  const actualHours = sumDecimals(labor.map((shift) => shift.actualHours!))
  const scheduledHours = sumDecimals(
    labor.map((shift) => shift.scheduledHours!),
  )
  if (!laborCost || !actualHours || !scheduledHours) return undefined
  return { laborCost, actualHours, scheduledHours }
}

function subtractDecimalStrings(left: string, right: string) {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return undefined
  return decimalToString(
    add(parsedLeft, {
      coefficient: -parsedRight.coefficient,
      scale: parsedRight.scale,
    }),
  )
}

function compareDecimalStrings(left: string, right: string) {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return 0
  const scale = Math.max(parsedLeft.scale, parsedRight.scale)
  const leftValue =
    parsedLeft.coefficient * 10n ** BigInt(scale - parsedLeft.scale)
  const rightValue =
    parsedRight.coefficient * 10n ** BigInt(scale - parsedRight.scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function averageDecimals(values: readonly string[]) {
  const total = sumDecimals(values)
  if (total === undefined || values.length === 0) return undefined
  return decimalToString(
    divide(
      parseDecimal(total)!,
      { coefficient: BigInt(values.length), scale: 0 },
      RATIO_SCALE,
    ),
  )
}

function divide(left: Decimal, right: Decimal, scale: number): Decimal {
  if (right.coefficient === 0n) throw new Error('Cannot divide by zero.')
  const exponent = scale + right.scale - left.scale
  let numerator = left.coefficient
  let denominator = right.coefficient
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent)
  else denominator *= 10n ** BigInt(-exponent)

  const negative = numerator < 0n !== denominator < 0n
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator)
    quotient += 1n
  return normalize({ coefficient: negative ? -quotient : quotient, scale })
}

function weightedUnitCost(
  orderQty: readonly string[],
  orderCost: readonly string[],
): string | undefined {
  const quantity = sumDecimals(orderQty)
  const cost = sumDecimals(orderCost)
  const parsedQuantity = quantity ? parseDecimal(quantity) : undefined
  const parsedCost = cost ? parseDecimal(cost) : undefined
  if (!parsedQuantity || !parsedCost || parsedQuantity.coefficient === 0n)
    return undefined
  return decimalToString(divide(parsedCost, parsedQuantity, RATIO_SCALE))
}

function calculated(
  metricKey: PrecomputedMetric,
  result: MetricResult<string>,
): StoredMetric {
  return {
    metricKey,
    status: result.status,
    value: result.status === 'calculated' ? result.value : null,
    result,
  }
}

function calculatedWithSpoilageResolution(
  metricKey: PrecomputedMetric,
  result: SpoilageResolutionResult,
): SpoilageStoredMetric {
  return {
    ...calculated(metricKey, result.metric),
    result: { ...result.metric, resolution: result.resolution },
  }
}

function spoilageResolutionOf(metric: StoredMetric) {
  const result = metric.result as StoredMetric['result'] & {
    resolution?: SpoilageResolution
  }
  return result.resolution
}

function latestSnapshot(
  snapshots: readonly PrecomputeSnapshot[],
  itemId: string,
) {
  return snapshots
    .filter((snapshot) => snapshot.itemId === itemId)
    .sort((left, right) => left.countedAt.getTime() - right.countedAt.getTime())
    .at(-1)
}

function metricSet(
  item: PrecomputeItem,
  sales: readonly PrecomputeSale[],
  orders: readonly PrecomputeOrder[],
  snapshots: readonly PrecomputeSnapshot[],
  now: Date,
): StoredMetric[] {
  const itemSales = sales.filter((sale) => sale.itemId === item.id)
  const itemOrders = orders.filter((order) => order.itemId === item.id)
  const sold = sumDecimals(itemSales.map((sale) => sale.qty))
  const revenue = sumDecimals(itemSales.map((sale) => sale.revenue))
  const ordered = sumDecimals(itemOrders.map((order) => order.qty))
  const onHand = latestSnapshot(snapshots, item.id)?.qty
  const itemSnapshots = snapshots.filter(
    (snapshot) => snapshot.itemId === item.id,
  )
  const unitCost =
    weightedUnitCost(
      itemOrders.map((order) => order.qty),
      itemOrders.map((order) => order.totalCost),
    ) ??
    item.costPerUnit ??
    undefined
  const costOfSales =
    itemSales.length > 0 &&
    itemSales.every((sale) => typeof sale.totalCost === 'string')
      ? sumDecimals(itemSales.map((sale) => sale.totalCost as string))
      : undefined
  const common = { unit: item.unit, currency: 'USD' }
  const freshnessAnchorAt = [
    ...itemSnapshots.map((snapshot) => snapshot.countedAt),
    ...itemOrders.map((order) => order.orderedAt),
  ]
    .sort((left, right) => left.getTime() - right.getTime())
    .at(-1)
  const sufficiency = calculateDataSufficiency({
    transactions: itemSales,
    purchaseOrders: itemOrders.map(({ orderedAt }) => ({ orderedAt })),
    inventorySnapshots: itemSnapshots.map(({ countedAt }) => ({ countedAt })),
  })

  const spoilage = resolveSpoilage({
    sales: itemSales.map(({ qty, transactedAt }) => ({
      qty,
      transactedAt,
    })),
    orders: itemOrders.map(({ qty, orderedAt }) => ({ qty, orderedAt })),
    snapshots: itemSnapshots,
    periodEnd: now,
  })
  const historicalSpoilageQty = sumDecimals(
    spoilage.resolution.figures
      .filter((figure) => {
        const value = parseDecimal(figure.value)
        return value !== undefined && value.coefficient > 0n
      })
      .map((figure) => figure.value),
  )

  return [
    calculated(
      'sellThrough',
      sellThroughRate({
        ...common,
        ...(sold === undefined ? {} : { qtySold: sold }),
        ...(ordered === undefined ? {} : { qtyOrdered: ordered }),
      }),
    ),
    calculatedWithSpoilageResolution(
      'spoilageEstimate',
      resolveSpoilage({
        sales: itemSales.map(({ qty, transactedAt }) => ({
          qty,
          transactedAt,
        })),
        orders: itemOrders.map(({ qty, orderedAt }) => ({ qty, orderedAt })),
        snapshots: itemSnapshots,
        periodEnd: now,
      }),
    ),
    calculated(
      'spoilageRisk',
      spoilageRisk({
        ...common,
        ...(onHand === undefined ? {} : { qtyOnHand: onHand }),
        ...(unitCost === undefined ? {} : { unitCost }),
      }),
    ),
    calculated(
      'margin',
      margin({
        ...common,
        ...(revenue === undefined ? {} : { revenue }),
        ...(sold === undefined ? {} : { qtySold: sold }),
        ...(unitCost === undefined ? {} : { unitCost }),
      }),
    ),
    calculated(
      'variance',
      variance({
        unit: item.unit,
        ...(ordered === undefined ? {} : { qtyOrdered: ordered }),
        ...(sold === undefined ? {} : { qtySold: sold }),
        ...(onHand === undefined ? {} : { qtyOnHand: onHand }),
      }),
    ),
    calculated(DATA_SUFFICIENCY_METRIC, sufficiency),
    calculated(
      'impact',
      calculateImpact({
        ...(onHand === undefined ? {} : { qtyOnHand: onHand }),
        ...(historicalSpoilageQty === undefined
          ? {}
          : { historicalSpoilageQty }),
        ...(ordered === undefined ? {} : { qtyOrdered: ordered }),
        ...(sold === undefined ? {} : { qtySold: sold }),
        ...(revenue === undefined ? {} : { revenue }),
        ...(costOfSales === undefined ? {} : { costOfSales }),
        ...(unitCost === undefined ? {} : { unitCost }),
        unit: item.unit,
        currency: 'USD',
      }),
    ),
    calculated(
      'urgency',
      calculateUrgency({
        ...(item.shelfLifeDays === undefined
          ? {}
          : { shelfLifeDays: item.shelfLifeDays }),
        ...(freshnessAnchorAt ? { freshnessAnchorAt } : {}),
        sales: itemSales.map(({ qty, transactedAt }) => ({
          qty,
          transactedAt,
        })),
        orders: itemOrders.map(({ orderedAt, receivedAt }) => ({
          orderedAt,
          ...(receivedAt === undefined ? {} : { receivedAt }),
        })),
        now,
      }),
    ),
  ]
}

function unavailableRollup(
  metricKey: PrecomputedMetric,
  reason: string,
  inputs: Record<string, string> = {},
): StoredMetric {
  return calculated(metricKey, {
    status: 'cannot-calculate',
    reason,
    inputs,
    units: { value: 'location rollup' },
  })
}

function rollupMetric(
  metricKey: PrecomputedMetric,
  itemResults: readonly StoredMetric[][],
  input: PrecomputeInput,
): StoredMetric {
  const values = itemResults
    .map((metrics) => metrics.find((metric) => metric.metricKey === metricKey))
    .filter((metric): metric is StoredMetric => metric !== undefined)
  const calculatedValues = values.filter(
    (metric): metric is StoredMetric & { value: string } =>
      metric.status === 'calculated' && metric.value !== null,
  )

  if (metricKey === 'impact') {
    const impactResults = values
      .map((metric) => metric.result)
      .filter(
        (result): result is ImpactMetricResult =>
          'categories' in result && 'weights' in result,
      )
    return calculated(
      metricKey,
      rollupImpact(impactResults, {}, laborVarianceInput(input.labor ?? [])),
    )
  }

  if (metricKey === 'urgency') {
    const urgencyResults = values
      .map((metric) => metric.result)
      .filter(
        (result): result is ReturnType<typeof calculateUrgency> =>
          'components' in result && 'thresholds' in result,
      )
    return calculated(metricKey, rollupUrgency(urgencyResults))
  }

  if (calculatedValues.length !== values.length || values.length === 0) {
    return unavailableRollup(
      metricKey,
      'cannot calculate, one or more item metrics are unavailable',
      {
        itemCount: String(values.length),
        calculatedItemCount: String(calculatedValues.length),
      },
    )
  }

  if (metricKey === 'sellThrough' || metricKey === 'variance') {
    const units = new Set(input.items.map((item) => item.unit))
    if (units.size > 1) {
      return unavailableRollup(
        metricKey,
        'cannot calculate, location contains mixed quantity units',
        { unitCount: String(units.size) },
      )
    }

    const itemIds = new Set(input.items.map((item) => item.id))
    const sales = input.sales.filter(
      (sale) => sale.itemId !== null && itemIds.has(sale.itemId),
    )
    const orders = input.orders.filter(
      (order) => order.itemId !== null && itemIds.has(order.itemId),
    )
    const sold = sumDecimals(sales.map((sale) => sale.qty))
    const ordered = sumDecimals(orders.map((order) => order.qty))
    const currentSnapshots = input.items.map((item) =>
      latestSnapshot(input.snapshots, item.id),
    )
    const onHand = currentSnapshots.every(Boolean)
      ? sumDecimals(currentSnapshots.map((snapshot) => snapshot?.qty ?? '0'))
      : undefined
    const unit = [...units][0] ?? 'units'
    const result =
      metricKey === 'sellThrough'
        ? sellThroughRate({
            unit,
            ...(sold === undefined ? {} : { qtySold: sold }),
            ...(ordered === undefined ? {} : { qtyOrdered: ordered }),
          })
        : variance({
            unit,
            ...(sold === undefined ? {} : { qtySold: sold }),
            ...(ordered === undefined ? {} : { qtyOrdered: ordered }),
            ...(onHand === undefined ? {} : { qtyOnHand: onHand }),
          })
    return calculated(metricKey, result)
  }

  if (metricKey === DATA_SUFFICIENCY_METRIC) {
    return calculated(
      metricKey,
      calculateDataSufficiency({
        transactions: input.sales,
        purchaseOrders: input.orders.map(({ orderedAt }) => ({ orderedAt })),
        inventorySnapshots: input.snapshots.map(({ countedAt }) => ({
          countedAt,
        })),
      }),
    )
  }

  const value = sumDecimals(calculatedValues.map((metric) => metric.value))
  if (value === undefined) {
    return calculated(metricKey, {
      status: 'cannot-calculate',
      reason: 'cannot calculate, item metrics are not valid decimals',
      inputs: {},
      units: { value: 'location rollup' },
    })
  }

  if (metricKey === 'spoilageEstimate') {
    const itemIds = new Set(input.items.map((item) => item.id))
    const orderedQuantity = sumDecimals(
      input.orders
        .filter((order) => order.itemId !== null && itemIds.has(order.itemId))
        .map((order) => order.qty),
    )
    const resolutions = calculatedValues
      .map(spoilageResolutionOf)
      .filter(
        (resolution): resolution is SpoilageResolution =>
          resolution !== undefined,
      )
    const methods = new Set(
      resolutions.flatMap((resolution) =>
        resolution.figures.map((figure) => figure.method),
      ),
    )
    const resolution: SpoilageResolution = {
      method: methods.size === 1 ? ([...methods][0] ?? null) : 'mixed',
      fallbackWindowDays: Math.max(
        ...resolutions.map((item) => item.fallbackWindowDays),
        METRICS_CONFIG.spoilage.fallbackWindowDays,
      ),
      figures: resolutions.flatMap((item) => item.figures),
      variances: resolutions.flatMap((item) => item.variances),
    }
    const result: MetricResult<string> = {
      status: 'calculated',
      value,
      inputs: {
        itemCount: String(values.length),
        calculatedItemCount: String(calculatedValues.length),
        ...(orderedQuantity === undefined ? {} : { orderedQuantity }),
      },
      units: { value: 'location rollup' },
    }
    return {
      metricKey,
      status: result.status,
      value: result.value,
      result: { ...result, resolution } as StoredMetric['result'] & {
        resolution: SpoilageResolution
      },
    }
  }

  return calculated(metricKey, {
    status: 'calculated',
    value,
    inputs: {
      itemCount: String(values.length),
      calculatedItemCount: String(calculatedValues.length),
    },
    units: { value: 'location rollup' },
  })
}

function forecastRollup(forecast: DemandForecastResult): StoredMetric {
  const suppressed = forecast.status === 'suppressed'
  const calculablePeriods = forecast.periods.filter(
    (period) =>
      period.covers.status === 'calculated' &&
      period.sales.status === 'calculated',
  ).length
  const result: MetricResult<string> = suppressed
    ? {
        status: 'cannot-calculate',
        reason: forecast.reason ?? 'forecast is suppressed',
        inputs: { historyDays: String(forecast.historyDays) },
        units: { value: 'forecast' },
      }
    : {
        status: 'calculated',
        value: String(calculablePeriods),
        inputs: {
          historyDays: String(forecast.historyDays),
          periodCount: String(forecast.periods.length),
          calculablePeriods: String(calculablePeriods),
        },
        units: { value: 'forecast periods' },
      }
  return {
    metricKey: 'demandForecast',
    status: result.status,
    value: suppressed ? null : String(calculablePeriods),
    result: { ...result, forecast } as unknown as StoredMetric['result'],
  }
}

function staffingRecommendationsRollup(
  recommendations: ReturnType<typeof buildShiftRecommendations>,
): StoredMetric {
  const result: MetricResult<string> =
    recommendations.length === 0
      ? {
          status: 'cannot-calculate',
          reason: 'no shift-level recommendation has enough comparable data',
          inputs: { recommendationCount: '0' },
          units: { value: 'staffing recommendations' },
        }
      : {
          status: 'calculated',
          value: String(recommendations.length),
          inputs: { recommendationCount: String(recommendations.length) },
          units: { value: 'staffing recommendations' },
        }
  return {
    metricKey: 'staffingRecommendations',
    status: result.status,
    value: result.status === 'calculated' ? result.value : null,
    result: { ...result, recommendations } as unknown as StoredMetric['result'],
  }
}

export function buildPrecomputeResults(
  input: PrecomputeInput,
  now = new Date(),
): PrecomputeOutput {
  const timestamps = [
    ...input.sales.map((row) => row.transactedAt),
    ...input.orders.map((row) => row.orderedAt),
    ...input.snapshots.map((row) => row.countedAt),
  ]
  const inputWindowStart = timestamps.reduce(
    (earliest, timestamp) => (timestamp < earliest ? timestamp : earliest),
    now,
  )
  const inputWindowEnd = timestamps.reduce(
    (latest, timestamp) => (timestamp > latest ? timestamp : latest),
    inputWindowStart,
  )
  const itemResults = input.items.map((item) => ({
    itemId: item.id,
    metrics: metricSet(item, input.sales, input.orders, input.snapshots, now),
  }))
  const metricSets = itemResults.map((item) => item.metrics)
  const menuCandidates = buildMenuRecommendationCandidates(
    input.menuRecommendations ?? {},
  )
  const rankedItems = rankRecommendations([
    ...precomputedRankingCandidates(itemResults),
    ...menuCandidates.map((candidate) => ({
      itemId: candidate.candidateId,
      dimensions: candidate.dimensions,
    })),
  ])
  const inventoryItemIds = new Set(itemResults.map((item) => item.itemId))
  const rankedInventoryItems = rankedItems.filter((item) =>
    inventoryItemIds.has(item.itemId),
  )
  const rankedMenuItems = rankedItems.filter((item) =>
    menuCandidates.some((candidate) => candidate.candidateId === item.itemId),
  )

  const inventoryRecommendations = assembleRecommendationRecords({
    items: input.items.map((item) => ({
      itemId: item.id,
      itemName: item.displayName ?? item.id,
      unit: item.unit,
      ...(item.shelfLifeDays === undefined
        ? {}
        : { shelfLifeDays: item.shelfLifeDays }),
      purchaseOrderCount: input.orders.filter(
        (order) => order.itemId === item.id,
      ).length,
      sales: input.sales
        .filter((sale) => sale.itemId === item.id)
        .map(({ qty, transactedAt }) => ({ qty, transactedAt })),
      metrics:
        itemResults.find((result) => result.itemId === item.id)?.metrics ?? [],
    })),
    rankedItems: rankedInventoryItems,
    inputWindowStart,
    inputWindowEnd,
    currentDate: now,
    ...(input.sources ? { sources: input.sources } : {}),
    sourceCounts: {
      transactions: input.sales.length,
      purchaseOrders: input.orders.length,
      snapshots: input.snapshots.length,
    },
    ...(input.reconciliation
      ? { reconciliation: reconciliationTrace(input.reconciliation) }
      : {}),
  })
  const menuRecommendations = assembleMenuRecommendationRecords({
    candidates: menuCandidates,
    ranked: rankedMenuItems,
    inputWindowStart,
    inputWindowEnd,
    ...(input.menuRecommendations?.sources
      ? { sources: input.menuRecommendations.sources }
      : {}),
    ...(input.reconciliation
      ? { reconciliation: reconciliationTrace(input.reconciliation) }
      : {}),
  })

  const staffingRecommendations = input.demandForecast
    ? buildShiftRecommendations({
        forecast: input.demandForecast,
        sales: input.sales,
        labor: input.labor ?? [],
        timezone: input.timezone ?? 'UTC',
        businessDayBoundary: input.businessDayBoundary ?? '04:00',
        ...(input.sources ? { sources: input.sources } : {}),
        asOf: now,
      })
    : []

  return {
    itemResults,
    rollups: [
      ...PRECOMPUTED_METRICS.map((metricKey) =>
        rollupMetric(metricKey, metricSets, input),
      ),
      ...(input.demandForecast ? [forecastRollup(input.demandForecast)] : []),
      ...(input.demandForecast && (input.labor?.length ?? 0) > 0
        ? [staffingRecommendationsRollup(staffingRecommendations)]
        : []),
    ],
    rankedItems,
    recommendations: [...inventoryRecommendations, ...menuRecommendations],
    staffingRecommendations,
    inputWindowStart,
    inputWindowEnd,
  }
}

export async function loadPrecomputeInput(
  locationId: string,
): Promise<PrecomputeInput> {
  const { db } = await import('@/src/server/db/client')
  const [
    locationContext,
    signalRows,
    items,
    sales,
    labor,
    orders,
    snapshots,
    sources,
    costHistory,
    recipeRows,
    recipeIngredientRows,
    conversions,
  ] = await Promise.all([
    db
      .select({
        timezone: locations.timezone,
        businessDayBoundary: locations.businessDayBoundary,
      })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1),
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
      .where(eq(externalSignals.locationId, locationId)),
    db
      .select({
        id: inventoryItems.id,
        displayName: inventoryItems.displayName,
        unit: inventoryItems.unit,
        costPerUnit: inventoryItems.costPerUnit,
        shelfLifeDays: inventoryItems.shelfLifeDays,
        itemType: inventoryItems.itemType,
        menuPrice: inventoryItems.menuPrice,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.locationId, locationId))
      .orderBy(asc(inventoryItems.id)),
    db
      .select({
        itemId: transactions.menuItemId,
        qty: transactions.qty,
        revenue: transactions.totalRevenue,
        totalCost: transactions.totalCost,
        transactedAt: transactions.transactedAt,
        source: transactions.source,
        externalId: transactions.externalId,
      })
      .from(transactions)
      .where(eq(transactions.locationId, locationId)),
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
      .where(eq(laborShifts.locationId, locationId)),
    db
      .select({
        itemId: purchaseOrderItems.inventoryItemId,
        qty: purchaseOrderItems.qty,
        totalCost: purchaseOrderItems.totalCost,
        orderedAt: purchaseOrders.orderedAt,
        receivedAt: purchaseOrders.receivedAt,
        source: purchaseOrders.source,
        externalId: purchaseOrders.externalId,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .where(eq(purchaseOrderItems.locationId, locationId)),
    db
      .select({
        itemId: inventorySnapshots.inventoryItemId,
        qty: inventorySnapshots.qty,
        countedAt: inventorySnapshots.countedAt,
        source: inventorySnapshots.source,
        externalId: sql`null`.as<string | null>(),
      })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, locationId)),
    db
      .select({
        filename: csvUploadHistory.filename,
        source: csvUploadHistory.source,
        rowCount: csvUploadHistory.rowsImported,
        uploadedAt: csvUploadHistory.uploadedAt,
      })
      .from(csvUploadHistory)
      .where(
        and(
          eq(csvUploadHistory.locationId, locationId),
          eq(csvUploadHistory.status, 'imported'),
        ),
      )
      .orderBy(asc(csvUploadHistory.uploadedAt), asc(csvUploadHistory.id)),
    db
      .select({
        menuItemId: recipes.menuItemId,
        calculatedAt: recipeCostHistory.calculatedAt,
        batchCost: recipeCostHistory.batchCost,
        costPerOutput: recipeCostHistory.costPerOutput,
        menuPrice: recipeCostHistory.menuPrice,
      })
      .from(recipeCostHistory)
      .innerJoin(recipes, eq(recipes.id, recipeCostHistory.recipeId))
      .where(
        and(
          eq(recipeCostHistory.locationId, locationId),
          eq(recipeCostHistory.status, 'complete'),
          eq(recipes.isActive, true),
        ),
      )
      .orderBy(desc(recipeCostHistory.calculatedAt)),
    db
      .select({
        id: recipes.id,
        menuItemId: recipes.menuItemId,
        outputQuantity: recipes.outputQuantity,
        outputUnit: recipes.outputUnit,
        yieldFactor: recipes.yieldFactor,
        wasteFactor: recipes.wasteFactor,
      })
      .from(recipes)
      .where(
        and(eq(recipes.locationId, locationId), eq(recipes.isActive, true)),
      ),
    db
      .select({
        recipeId: recipeIngredients.recipeId,
        ingredientItemId: recipeIngredients.ingredientItemId,
        subRecipeId: recipeIngredients.subRecipeId,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
      })
      .from(recipeIngredients)
      .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
      .where(
        and(eq(recipes.locationId, locationId), eq(recipes.isActive, true)),
      ),
    db
      .select({
        inventoryItemId: itemUnitConversions.inventoryItemId,
        fromUnit: itemUnitConversions.fromUnit,
        toUnit: itemUnitConversions.toUnit,
        factor: itemUnitConversions.factor,
      })
      .from(itemUnitConversions)
      .where(eq(itemUnitConversions.locationId, locationId)),
  ])

  const reconciliationRecords = [
    ...sales.map((sale) => ({
      kind: 'transaction' as const,
      source: sale.source,
      externalId: sale.externalId,
      occurredAt: sale.transactedAt,
    })),
    ...orders.map((order) => ({
      kind: 'purchase_order' as const,
      source: order.source,
      externalId: order.externalId,
      occurredAt: order.orderedAt,
    })),
    ...snapshots.map((snapshot) => ({
      kind: 'inventory' as const,
      source: snapshot.source,
      externalId: snapshot.externalId,
      occurredAt: snapshot.countedAt,
    })),
  ]
  const detectedReconciliation = detectReconciliationConflicts(
    reconciliationRecords,
  )
  const reconciliation = mergeReconciliationDecisions(
    detectedReconciliation,
    await listReconciliationConflicts(locationId),
  )
  const includedSales = sales.filter((sale) =>
    shouldIncludeRecord(
      {
        kind: 'transaction',
        source: sale.source,
        externalId: sale.externalId,
        occurredAt: sale.transactedAt,
      },
      reconciliation,
    ),
  )
  const includedOrders = orders.filter((order) =>
    shouldIncludeRecord(
      {
        kind: 'purchase_order',
        source: order.source,
        externalId: order.externalId,
        occurredAt: order.orderedAt,
      },
      reconciliation,
    ),
  )
  const includedSnapshots = snapshots.filter((snapshot) =>
    shouldIncludeRecord(
      {
        kind: 'inventory',
        source: snapshot.source,
        externalId: snapshot.externalId,
        occurredAt: snapshot.countedAt,
      },
      reconciliation,
    ),
  )

  const normalizedItems: PrecomputeItem[] = items.map((item) => ({
    ...item,
    itemType: item.itemType === 'menu_item' ? 'menu_item' : 'ingredient',
  }))
  const menuItems = normalizedItems.filter(
    (item) => item.itemType === 'menu_item',
  )
  const latestCostByMenuItem = new Map<string, (typeof costHistory)[number]>()
  const previousCostByMenuItem = new Map<string, (typeof costHistory)[number]>()
  for (const history of costHistory) {
    if (!latestCostByMenuItem.has(history.menuItemId)) {
      latestCostByMenuItem.set(history.menuItemId, history)
    } else if (!previousCostByMenuItem.has(history.menuItemId)) {
      previousCostByMenuItem.set(history.menuItemId, history)
    }
  }
  const unitsSoldByMenuItem = new Map<string, string>()
  for (const sale of includedSales) {
    if (!sale.itemId || !menuItems.some((item) => item.id === sale.itemId))
      continue
    const total = sumDecimals([
      unitsSoldByMenuItem.get(sale.itemId) ?? '0',
      sale.qty,
    ])
    if (total !== undefined) unitsSoldByMenuItem.set(sale.itemId, total)
  }
  const marginRows = menuItems.flatMap((item) => {
    const history = latestCostByMenuItem.get(item.id)
    if (!history?.costPerOutput || !item.menuPrice) return []
    const marginPerItem = subtractDecimalStrings(
      item.menuPrice,
      history.costPerOutput,
    )
    if (marginPerItem === undefined) return []
    return [{ item, marginPerItem }]
  })
  const marginThreshold = averageDecimals(
    marginRows.map((row) => row.marginPerItem),
  )
  const menuRecommendations: MenuRecommendationInput = {
    marginErosion:
      marginThreshold === undefined
        ? []
        : marginRows.flatMap(({ item, marginPerItem }) => {
            const unitsSold = unitsSoldByMenuItem.get(item.id)
            if (
              !unitsSold ||
              compareDecimalStrings(marginPerItem, marginThreshold) >= 0
            )
              return []
            return [
              {
                itemId: item.id,
                itemName: item.displayName ?? item.id,
                unit: 'plates',
                marginPerItem,
                marginThreshold,
                unitsSold,
              },
            ]
          }),
    ingredientCostIncrease: menuItems.flatMap((item) => {
      const current = latestCostByMenuItem.get(item.id)
      const previous = previousCostByMenuItem.get(item.id)
      const unitsSold = unitsSoldByMenuItem.get(item.id)
      if (
        !current?.batchCost ||
        !previous?.batchCost ||
        !current.menuPrice ||
        !previous.menuPrice ||
        !unitsSold
      )
        return []
      return [
        {
          ingredientItemId: item.id,
          ingredientName: item.displayName ?? item.id,
          unit: 'plates',
          previousBatchCost: previous.batchCost,
          currentBatchCost: current.batchCost,
          previousMenuPrice: previous.menuPrice,
          currentMenuPrice: current.menuPrice,
          unitsSold,
        },
      ]
    }),
    recipeVariance: buildRecipeVarianceRecommendations({
      items: normalizedItems,
      sales: includedSales,
      orders: includedOrders,
      snapshots: includedSnapshots,
      recipeRows,
      recipeIngredientRows,
      conversions,
    }),
    sources: [
      ...sources,
      ...(costHistory.length > 0
        ? [
            {
              filename: 'recipe cost history',
              source: 'recipe_cost_history',
              rowCount: costHistory.length,
              uploadedAt: costHistory[0]?.calculatedAt ?? new Date(),
            },
          ]
        : []),
    ],
  }

  const forecastLocation = locationContext[0]
  const demandForecast = forecastLocation
    ? buildDemandForecast({
        timezone: forecastLocation.timezone,
        businessDayBoundary: forecastLocation.businessDayBoundary,
        sales: includedSales.map((sale) => ({
          transactedAt: sale.transactedAt,
          qty: sale.qty,
          revenue: sale.revenue,
        })),
        sources,
        externalSignals: signalRows.map((signal) => ({
          ...signal,
          kind: signal.kind as 'weather' | 'event',
          status: signal.status as 'observed' | 'forecast',
          value: signal.value,
        })),
      })
    : undefined

  return {
    items: normalizedItems,
    sales: includedSales,
    labor,
    ...(forecastLocation
      ? {
          timezone: forecastLocation.timezone,
          businessDayBoundary: forecastLocation.businessDayBoundary,
        }
      : {}),
    orders: includedOrders,
    snapshots: includedSnapshots,
    sources,
    reconciliation,
    menuRecommendations,
    ...(demandForecast ? { demandForecast } : {}),
    externalSignals: signalRows.map((signal) => ({
      ...signal,
      kind: signal.kind as 'weather' | 'event',
      status: signal.status as 'observed' | 'forecast',
      value: signal.value,
    })),
  }
}

type PrecomputeRecipeRow = {
  id: string
  menuItemId: string
  outputQuantity: string
  outputUnit: string
  yieldFactor: string
  wasteFactor: string
}

type PrecomputeRecipeIngredientRow = {
  recipeId: string
  ingredientItemId: string | null
  subRecipeId: string | null
  quantity: string
  unit: string
}

type PrecomputeConversionRow = {
  inventoryItemId: string
  fromUnit: string
  toUnit: string
  factor: string
}

function buildRecipeVarianceRecommendations(input: {
  items: readonly PrecomputeItem[]
  sales: readonly PrecomputeSale[]
  orders: readonly PrecomputeOrder[]
  snapshots: readonly PrecomputeSnapshot[]
  recipeRows: readonly PrecomputeRecipeRow[]
  recipeIngredientRows: readonly PrecomputeRecipeIngredientRow[]
  conversions: readonly PrecomputeConversionRow[]
}) {
  const itemById = new Map(input.items.map((item) => [item.id, item]))
  const ingredientsByRecipe = new Map<
    string,
    Array<{
      ingredientItemId?: string
      subRecipeId?: string
      quantity: string
      unit: string
    }>
  >()
  for (const row of input.recipeIngredientRows) {
    const ingredients = ingredientsByRecipe.get(row.recipeId) ?? []
    ingredients.push({
      quantity: row.quantity,
      unit: row.unit,
      ...(row.ingredientItemId
        ? { ingredientItemId: row.ingredientItemId }
        : {}),
      ...(row.subRecipeId ? { subRecipeId: row.subRecipeId } : {}),
    })
    ingredientsByRecipe.set(row.recipeId, ingredients)
  }

  const result = buildUsageVariance({
    inventoryItems: input.items.map((item) => ({
      id: item.id,
      displayName: item.displayName ?? item.id,
      unit: item.unit,
    })),
    recipes: input.recipeRows.map((recipe) => ({
      ...recipe,
      ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
    })),
    sales: input.sales.flatMap((sale) =>
      sale.itemId
        ? [
            {
              menuItemId: sale.itemId,
              qty: sale.qty,
              transactedAt: sale.transactedAt,
            },
          ]
        : [],
    ),
    purchases: input.orders.flatMap((order) =>
      order.itemId
        ? [
            {
              inventoryItemId: order.itemId,
              qty: order.qty,
              unit: itemById.get(order.itemId)?.unit ?? 'units',
              orderedAt: order.orderedAt,
            },
          ]
        : [],
    ),
    snapshots: input.snapshots.map((snapshot) => ({
      inventoryItemId: snapshot.itemId,
      qty: snapshot.qty,
      countedAt: snapshot.countedAt,
    })),
    conversions: input.conversions,
  })

  return result.rows.flatMap((row) => {
    if (row.status !== 'calculated' || row.variance === null) return []
    return [
      {
        ingredientItemId: row.ingredientItemId,
        ingredientName: row.ingredientName,
        unit: row.unit,
        variance: row.variance,
        variancePercent: row.variancePercent,
        ingredientCostPerUnit:
          itemById.get(row.ingredientItemId)?.costPerUnit ?? null,
      },
    ]
  })
}

export async function runPrecomputeForLocation(
  locationId: string,
  options: { now?: Date } = {},
) {
  const startedAt = options.now ?? new Date()
  const { db } = await import('@/src/server/db/client')
  try {
    const output = buildPrecomputeResults(
      await loadPrecomputeInput(locationId),
      startedAt,
    )

    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(metricRuns)
        .values({
          locationId,
          status: 'running',
          inputWindowStart: output.inputWindowStart,
          inputWindowEnd: output.inputWindowEnd,
          startedAt,
          completedAt: null,
          error: null,
        })
        .returning({ id: metricRuns.id })
      if (!run) throw new Error('The metric run could not be started.')

      const metricResultRows = [
        ...output.itemResults.flatMap((item) =>
          item.metrics.map((metric) => ({
            runId: run.id,
            locationId,
            inventoryItemId: item.itemId,
            metricKey: metric.metricKey,
            status: metric.status,
            value: metric.value,
            result: metric.result,
          })),
        ),
        ...output.recommendations.map((recommendation) => ({
          runId: run.id,
          locationId,
          inventoryItemId: recommendation.itemId,
          metricKey: recommendationMetricKey(recommendation),
          status: 'calculated' as const,
          value: recommendation.score,
          result: recommendation,
        })),
      ]
      if (metricResultRows.length > 0) {
        await tx.insert(metricResults).values(metricResultRows)
      }
      await tx.insert(metricRollups).values(
        output.rollups.map((metric) => ({
          runId: run.id,
          locationId,
          metricKey: metric.metricKey,
          status: metric.status,
          value: metric.value,
          result: metric.result,
        })),
      )
      const completedAt = new Date()
      const [completed] = await tx
        .update(metricRuns)
        .set({ status: 'succeeded', completedAt })
        .where(eq(metricRuns.id, run.id))
        .returning()
      return completed
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await db
      .insert(metricRuns)
      .values({
        locationId,
        status: 'failed',
        inputWindowStart: startedAt,
        inputWindowEnd: startedAt,
        startedAt,
        completedAt: null,
        error: message,
      })
      .catch(() => undefined)
    throw error
  }
}

export async function getLatestSuccessfulMetricRun(locationId: string) {
  const { db } = await import('@/src/server/db/client')
  const [run] = await db
    .select()
    .from(metricRuns)
    .where(
      and(
        eq(metricRuns.locationId, locationId),
        eq(metricRuns.status, 'succeeded'),
      ),
    )
    .orderBy(desc(metricRuns.completedAt), desc(metricRuns.id))
    .limit(1)
  return run ?? null
}
