import { and, asc, eq } from 'drizzle-orm'

import { getShelfLifeSuggestion } from '@/src/server/inventory/shelf-life-defaults'
import { buildDashboardRecommendations } from './dashboard-recommendations'
import { getLatestSuccessfulMetricRun } from './precompute'
import { sellThroughRate } from './definitions'
import type { RecommendationRecord } from './recommendations'

type Decimal = { coefficient: bigint; scale: number }

export type ItemDeepDiveSale = {
  transactedAt: Date
  quantity: string
  revenue: string
}

export type ItemDeepDiveOrder = {
  orderedAt: Date
  quantity: string
  totalCost: string
}

export type ItemDeepDive = {
  itemId: string
  displayName: string
  category: string | null
  unit: string
  quantitySold: string | null
  quantityOrdered: string | null
  quantityOnHand: string | null
  totalRevenue: string | null
  margin: string | null
  spoilageRisk: string | null
  sellThroughRate: string | null
  unitCost: string | null
  unitCostSource: 'purchase orders' | 'item settings' | 'not available'
  shelfLifeDays: number | null
  shelfLifeSource: 'item setting' | 'category suggestion' | 'not available'
  shelfLifeCategory: string | null
  recentSales: readonly ItemDeepDiveSale[]
  recentOrders: readonly ItemDeepDiveOrder[]
  recommendations: readonly RecommendationRecord[]
}

export type ItemDeepDiveGroups = {
  topSelling: readonly ItemDeepDive[]
  spoilageRisk: readonly ItemDeepDive[]
  lowMargin: readonly ItemDeepDive[]
  needsData: readonly ItemDeepDive[]
}

type ItemInput = {
  id: string
  displayName: string
  category: string | null
  unit: string
  costPerUnit: string | null
  shelfLifeDays: number | null
}

type SaleInput = {
  itemId: string | null
  transactedAt: Date
  qty: string
  revenue: string
}

type OrderInput = {
  itemId: string | null
  orderedAt: Date
  qty: string
  totalCost: string
}

type SnapshotInput = {
  itemId: string
  countedAt: Date
  qty: string
}

type MetricInput = {
  itemId: string
  metricKey: string
  status: string
  value: string | null
  result: unknown
}

type RecommendationInput = {
  itemId: string
  result: unknown
}

type ObjectRecord = Record<string, unknown>

function isRecord(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

function normalize(value: Decimal): Decimal {
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function decimalToString(value: Decimal) {
  const normalized = normalize(value)
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

function sumDecimalStrings(values: readonly string[]) {
  if (values.length === 0) return null
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return null
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function divide(left: Decimal, right: Decimal, scale: number) {
  if (right.coefficient === 0n) return undefined
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

function weightedUnitCost(orders: readonly OrderInput[]) {
  const quantity = sumDecimalStrings(orders.map((order) => order.qty))
  const cost = sumDecimalStrings(orders.map((order) => order.totalCost))
  const parsedQuantity = quantity ? parseDecimal(quantity) : undefined
  const parsedCost = cost ? parseDecimal(cost) : undefined
  if (!parsedQuantity || !parsedCost) return null
  const result = divide(parsedCost, parsedQuantity, 6)
  return result ? decimalToString(result) : null
}

function compareDecimal(left: string, right: string) {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return 0
  const scale = Math.max(parsedLeft.scale, parsedRight.scale)
  const leftValue =
    parsedLeft.coefficient * 10n ** BigInt(scale - parsedLeft.scale)
  const rightValue =
    parsedRight.coefficient * 10n ** BigInt(scale - parsedRight.scale)
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1
}

function metricFor(
  metrics: readonly MetricInput[],
  itemId: string,
  metricKey: string,
) {
  return metrics.find(
    (metric) => metric.itemId === itemId && metric.metricKey === metricKey,
  )
}

function metricValue(
  metrics: readonly MetricInput[],
  itemId: string,
  metricKey: string,
) {
  const metric = metricFor(metrics, itemId, metricKey)
  return metric?.status === 'calculated' ? metric.value : null
}

function metricUnitCost(metrics: readonly MetricInput[], itemId: string) {
  const result = metricFor(metrics, itemId, 'spoilageRisk')?.result
  if (!isRecord(result) || !isRecord(result.inputs)) return null
  return typeof result.inputs.unitCost === 'string'
    ? result.inputs.unitCost
    : null
}

function activityLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function topBy(
  items: readonly ItemDeepDive[],
  value: (item: ItemDeepDive) => string | null,
  direction: 'asc' | 'desc',
) {
  return [...items]
    .filter((item) => value(item) !== null)
    .sort((left, right) => {
      const leftValue = value(left)
      const rightValue = value(right)
      if (leftValue === null || rightValue === null) return 0
      return direction === 'desc'
        ? compareDecimal(rightValue, leftValue)
        : compareDecimal(leftValue, rightValue)
    })
    .slice(0, 3)
}

export function buildItemDeepDives(input: {
  items: readonly ItemInput[]
  sales: readonly SaleInput[]
  orders: readonly OrderInput[]
  snapshots: readonly SnapshotInput[]
  metrics?: readonly MetricInput[]
  recommendations?: readonly RecommendationRecord[]
}): ItemDeepDive[] {
  const metrics = input.metrics ?? []
  const recommendations = input.recommendations ?? []

  return input.items.map((item) => {
    const sales = input.sales
      .filter((sale) => sale.itemId === item.id)
      .sort(
        (left, right) =>
          right.transactedAt.getTime() - left.transactedAt.getTime(),
      )
    const orders = input.orders
      .filter((order) => order.itemId === item.id)
      .sort(
        (left, right) => right.orderedAt.getTime() - left.orderedAt.getTime(),
      )
    const snapshots = input.snapshots
      .filter((snapshot) => snapshot.itemId === item.id)
      .sort(
        (left, right) => right.countedAt.getTime() - left.countedAt.getTime(),
      )
    const categorySuggestion = getShelfLifeSuggestion(item.category)
    const orderUnitCost = weightedUnitCost(orders)
    const calculatedUnitCost = metricUnitCost(metrics, item.id)
    const unitCost = orderUnitCost ?? calculatedUnitCost ?? item.costPerUnit
    const shelfLifeDays = item.shelfLifeDays ?? categorySuggestion?.days ?? null

    return {
      itemId: item.id,
      displayName: item.displayName,
      category: item.category,
      unit: item.unit,
      quantitySold: sumDecimalStrings(sales.map((sale) => sale.qty)),
      quantityOrdered: sumDecimalStrings(orders.map((order) => order.qty)),
      quantityOnHand: snapshots[0]?.qty ?? null,
      totalRevenue: sumDecimalStrings(sales.map((sale) => sale.revenue)),
      margin: metricValue(metrics, item.id, 'margin'),
      spoilageRisk: metricValue(metrics, item.id, 'spoilageRisk'),
      sellThroughRate: (() => {
        const result = sellThroughRate({
          ...(sumDecimalStrings(sales.map((sale) => sale.qty))
            ? {
                qtySold: sumDecimalStrings(
                  sales.map((sale) => sale.qty),
                ) as string,
              }
            : {}),
          ...(sumDecimalStrings(orders.map((order) => order.qty))
            ? {
                qtyOrdered: sumDecimalStrings(
                  orders.map((order) => order.qty),
                ) as string,
              }
            : {}),
          unit: item.unit,
        })
        return result.status === 'calculated' ? result.value : null
      })(),
      unitCost,
      unitCostSource: orderUnitCost
        ? 'purchase orders'
        : calculatedUnitCost || item.costPerUnit
          ? 'item settings'
          : 'not available',
      shelfLifeDays,
      shelfLifeSource:
        item.shelfLifeDays !== null
          ? 'item setting'
          : categorySuggestion
            ? 'category suggestion'
            : 'not available',
      shelfLifeCategory: categorySuggestion?.label ?? null,
      recentSales: sales.slice(0, 5).map((sale) => ({
        transactedAt: sale.transactedAt,
        quantity: sale.qty,
        revenue: sale.revenue,
      })),
      recentOrders: orders.slice(0, 5).map((order) => ({
        orderedAt: order.orderedAt,
        quantity: order.qty,
        totalCost: order.totalCost,
      })),
      recommendations: recommendations.filter(
        (recommendation) => recommendation.itemId === item.id,
      ),
    }
  })
}

export function buildItemDeepDiveGroups(
  items: readonly ItemDeepDive[],
): ItemDeepDiveGroups {
  const topSelling = topBy(items, (item) => item.totalRevenue, 'desc')
  const spoilageRisk = topBy(items, (item) => item.spoilageRisk, 'desc')
  const lowMargin = topBy(items, (item) => item.margin, 'asc')
  const rankedIds = new Set(
    [...topSelling, ...spoilageRisk, ...lowMargin].map((item) => item.itemId),
  )

  return {
    topSelling,
    spoilageRisk,
    lowMargin,
    needsData: items.filter((item) => !rankedIds.has(item.itemId)).slice(0, 3),
  }
}

/** Reads all item detail inputs through the selected owner's location boundary. */
export async function getDashboardItemDeepDives(
  headers: Headers,
  locationId: string,
) {
  const [
    { requireOwnedLocation },
    { db },
    {
      inventoryItems,
      inventorySnapshots,
      metricResults,
      purchaseOrderItems,
      purchaseOrders,
      transactions,
    },
  ] = await Promise.all([
    import('@/src/server/auth/authorization'),
    import('@/src/server/db/client'),
    import('@/src/server/db/schema'),
  ])
  const owned = await requireOwnedLocation(headers, locationId)
  const run = await getLatestSuccessfulMetricRun(owned.locationId)
  const [items, sales, orders, snapshots, metricRows] = await Promise.all([
    db
      .select({
        id: inventoryItems.id,
        displayName: inventoryItems.displayName,
        category: inventoryItems.category,
        unit: inventoryItems.unit,
        costPerUnit: inventoryItems.costPerUnit,
        shelfLifeDays: inventoryItems.shelfLifeDays,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.locationId, owned.locationId))
      .orderBy(asc(inventoryItems.displayName), asc(inventoryItems.id)),
    db
      .select({
        itemId: transactions.menuItemId,
        transactedAt: transactions.transactedAt,
        qty: transactions.qty,
        revenue: transactions.totalRevenue,
      })
      .from(transactions)
      .where(eq(transactions.locationId, owned.locationId)),
    db
      .select({
        itemId: purchaseOrderItems.inventoryItemId,
        orderedAt: purchaseOrders.orderedAt,
        qty: purchaseOrderItems.qty,
        totalCost: purchaseOrderItems.totalCost,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .where(eq(purchaseOrderItems.locationId, owned.locationId)),
    db
      .select({
        itemId: inventorySnapshots.inventoryItemId,
        countedAt: inventorySnapshots.countedAt,
        qty: inventorySnapshots.qty,
      })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, owned.locationId)),
    run
      ? db
          .select({
            itemId: metricResults.inventoryItemId,
            metricKey: metricResults.metricKey,
            status: metricResults.status,
            value: metricResults.value,
            result: metricResults.result,
          })
          .from(metricResults)
          .where(
            and(
              eq(metricResults.locationId, owned.locationId),
              eq(metricResults.runId, run.id),
            ),
          )
      : Promise.resolve([]),
  ])

  const recommendationRows: RecommendationInput[] = metricRows
    .filter((row) => row.metricKey.startsWith('recommendation'))
    .map((row) => ({ itemId: row.itemId, result: row.result }))
  const recommendations = buildDashboardRecommendations(
    recommendationRows,
    recommendationRows.length || 1,
  )

  return buildItemDeepDives({
    items,
    sales,
    orders,
    snapshots,
    metrics: metricRows.filter(
      (row) => !row.metricKey.startsWith('recommendation'),
    ),
    recommendations,
  })
}

export function formatItemActivityDate(date: Date) {
  return activityLabel(date)
}
