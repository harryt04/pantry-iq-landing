import { and, asc, desc, eq } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  inventorySnapshots,
  locations,
  metricResults,
  metricRollups,
  metricRuns,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'

import { businessDayBucket } from './definitions'

export const CONTEXT_BUNDLE_TOKEN_BUDGET = 2_000
const TOKEN_ESTIMATE_CHARS = 4
const CONTEXT_BUNDLE_VERSION = 1 as const

type ProvenancedValue = {
  value: string
  unit: string
  provenance: string
}

type BundleDate = {
  value: string
  unit: 'ISO-8601 date'
  provenance: string
}

type ContextSeriesPoint = {
  date: BundleDate
  sold: ProvenancedValue | null
  ordered: ProvenancedValue | null
  onHand: ProvenancedValue | null
}

type ContextMetric = {
  key: string
  status: 'calculated' | 'cannot-calculate'
  value: ProvenancedValue | null
  reason?: string
  provenance: string
}

type DistributionValue = {
  bucket: string
  unit: string
  sold: ProvenancedValue | null
  ordered: ProvenancedValue | null
}

export type ContextBundle = {
  version: typeof CONTEXT_BUNDLE_VERSION
  location: {
    id: string
    name: string
    timezone: string
    businessDayBoundary: string
    provenance: 'locations'
  }
  window: {
    start: string
    end: string
    provenance: 'normalized input rows'
  }
  items: Array<{
    id: string
    name: string
    category: string | null
    unit: string
    series: ContextSeriesPoint[]
    metrics: ContextMetric[]
    provenance: 'inventory_items and normalized input rows'
  }>
  categories: Array<{
    name: string
    itemIds: string[]
    itemCount: ProvenancedValue
    totals: DistributionValue[]
    provenance: 'inventory_items and normalized input rows'
  }>
  distributions: {
    dayOfWeek: DistributionValue[]
    timeOfDay: DistributionValue[]
    provenance: 'normalized transaction and purchase-order rows'
  }
  metrics: ContextMetric[]
  compaction: {
    omittedSeriesPoints: ProvenancedValue
    rule: 'oldest series points omitted first'
  }
}

export type ContextBundleResult = {
  bundle: ContextBundle
  estimatedTokens: number
  compacted: boolean
}

export type ContextBundleItem = {
  id: string
  name: string
  category?: string | null
  unit: string
}

export type ContextBundleSale = {
  itemId: string | null
  qty: string
  transactedAt: Date
}

export type ContextBundleOrder = {
  itemId: string | null
  qty: string
  orderedAt: Date
}

export type ContextBundleSnapshot = {
  itemId: string
  qty: string
  countedAt: Date
}

export type ContextBundleMetric = {
  itemId?: string
  metricKey: string
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  result: unknown
  provenance: string
}

export type ContextBundleInput = {
  location: {
    id: string
    name: string
    timezone: string
    businessDayBoundary: string
  }
  items: readonly ContextBundleItem[]
  sales: readonly ContextBundleSale[]
  orders: readonly ContextBundleOrder[]
  snapshots: readonly ContextBundleSnapshot[]
  itemMetrics: readonly ContextBundleMetric[]
  rollupMetrics: readonly ContextBundleMetric[]
  inputWindowStart: Date
  inputWindowEnd: Date
}

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const DAY_BUCKETS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
const TIME_BUCKETS = [
  '00:00–05:59',
  '06:00–11:59',
  '12:00–17:59',
  '18:00–23:59',
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

function decimalString(value: Decimal): string {
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  if (coefficient === 0n) return '0'
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient).toString()
  if (scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(scale + 1, '0')
  const splitAt = padded.length - scale
  return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
}

function addDecimal(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return {
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  }
}

function sum(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    total = addDecimal(total, parsed)
  }
  return decimalString(total)
}

function numberValue(
  value: string,
  unit: string,
  provenance: string,
): ProvenancedValue {
  return { value, unit, provenance }
}

function dateValue(value: string, provenance: string): BundleDate {
  return { value, unit: 'ISO-8601 date', provenance }
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return {
    weekday: parts.find((part) => part.type === 'weekday')?.value ?? 'Unknown',
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
  }
}

function businessDate(
  timestamp: Date,
  timezone: string,
  boundary: string,
  provenance: string,
) {
  const result = businessDayBucket({ timestamp, timezone, boundary })
  if (result.status !== 'calculated') return undefined
  return dateValue(result.value, provenance)
}

function metricUnit(result: unknown, metricKey: string) {
  const fallback = () => {
    if (metricKey === 'recommendation') return 'score'
    if (
      metricKey === 'impact' ||
      metricKey === 'urgency' ||
      metricKey === 'dataSufficiency'
    )
      return 'score'
    if (metricKey === 'sellThrough' || metricKey === 'variance') return '%'
    if (metricKey === 'margin' || metricKey === 'spoilageRisk') return 'USD'
    return 'recorded value'
  }
  if (!result || typeof result !== 'object' || Array.isArray(result))
    return fallback()
  const units = (result as { units?: unknown }).units
  if (!units || typeof units !== 'object' || Array.isArray(units))
    return fallback()
  const value = (units as { value?: unknown }).value
  if (typeof value === 'string') return value
  return fallback()
}

function metricReason(result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result))
    return undefined
  const reason = (result as { reason?: unknown }).reason
  return typeof reason === 'string' ? reason : undefined
}

function toContextMetric(metric: ContextBundleMetric): ContextMetric {
  return {
    key: metric.metricKey,
    status: metric.status,
    value:
      metric.status === 'calculated' && metric.value !== null
        ? numberValue(
            metric.value,
            metricUnit(metric.result, metric.metricKey),
            metric.provenance,
          )
        : null,
    ...(metric.status === 'cannot-calculate'
      ? { reason: metricReason(metric.result) ?? 'not available' }
      : {}),
    provenance: metric.provenance,
  }
}

function sortedMetrics(metrics: readonly ContextBundleMetric[]) {
  return [...metrics]
    .sort((left, right) => left.metricKey.localeCompare(right.metricKey))
    .map(toContextMetric)
}

function distributionValues(
  bucket: string,
  unit: string,
  sales: readonly ContextBundleSale[],
  orders: readonly ContextBundleOrder[],
  filter: (date: Date) => boolean,
  provenance: string,
): DistributionValue {
  const sold = sum(
    sales
      .filter((row) => row.itemId !== null && filter(row.transactedAt))
      .map((row) => row.qty),
  )
  const ordered = sum(
    orders
      .filter((row) => row.itemId !== null && filter(row.orderedAt))
      .map((row) => row.qty),
  )
  return {
    bucket,
    unit,
    sold: sold === undefined ? null : numberValue(sold, unit, provenance),
    ordered:
      ordered === undefined ? null : numberValue(ordered, unit, provenance),
  }
}

function buildDistributions(input: ContextBundleInput) {
  const units = [...new Set(input.items.map((item) => item.unit))].sort()
  const provenance = 'normalized transaction and purchase-order rows'
  return {
    dayOfWeek: units.flatMap((unit) =>
      DAY_BUCKETS.map((bucket) =>
        distributionValues(
          `${bucket} (${unit})`,
          unit,
          input.sales.filter(
            (row) =>
              row.itemId !== null &&
              input.items.find((item) => item.id === row.itemId)?.unit === unit,
          ),
          input.orders.filter(
            (row) =>
              row.itemId !== null &&
              input.items.find((item) => item.id === row.itemId)?.unit === unit,
          ),
          (date) =>
            localParts(date, input.location.timezone).weekday === bucket,
          provenance,
        ),
      ),
    ),
    timeOfDay: units.flatMap((unit) =>
      TIME_BUCKETS.map((bucket, index) =>
        distributionValues(
          `${bucket} (${unit})`,
          unit,
          input.sales.filter(
            (row) =>
              row.itemId !== null &&
              input.items.find((item) => item.id === row.itemId)?.unit === unit,
          ),
          input.orders.filter(
            (row) =>
              row.itemId !== null &&
              input.items.find((item) => item.id === row.itemId)?.unit === unit,
          ),
          (date) => {
            const hour = localParts(date, input.location.timezone).hour
            return hour >= index * 6 && hour < (index + 1) * 6
          },
          provenance,
        ),
      ),
    ),
    provenance: 'normalized transaction and purchase-order rows' as const,
  }
}

function buildSeries(input: ContextBundleInput, item: ContextBundleItem) {
  const dates = new Map<
    string,
    { sold: string[]; ordered: string[]; onHand: string[] }
  >()
  const ensure = (date: string) => {
    const current = dates.get(date) ?? { sold: [], ordered: [], onHand: [] }
    dates.set(date, current)
    return current
  }
  const dateFor = (timestamp: Date, source: string) =>
    businessDate(
      timestamp,
      input.location.timezone,
      input.location.businessDayBoundary,
      source,
    )?.value

  for (const row of input.sales) {
    if (row.itemId !== item.id) continue
    const date = dateFor(
      row.transactedAt,
      `transactions:${row.transactedAt.toISOString()}`,
    )
    if (date) ensure(date).sold.push(row.qty)
  }
  for (const row of input.orders) {
    if (row.itemId !== item.id) continue
    const date = dateFor(
      row.orderedAt,
      `purchase_orders:${row.orderedAt.toISOString()}`,
    )
    if (date) ensure(date).ordered.push(row.qty)
  }
  for (const row of input.snapshots) {
    if (row.itemId !== item.id) continue
    const date = dateFor(
      row.countedAt,
      `inventory_snapshots:${row.countedAt.toISOString()}`,
    )
    if (date) ensure(date).onHand.push(row.qty)
  }

  return [...dates.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date: dateValue(date, 'normalized input rows'),
      sold:
        sum(values.sold) === undefined
          ? null
          : numberValue(sum(values.sold)!, item.unit, 'transactions'),
      ordered:
        sum(values.ordered) === undefined
          ? null
          : numberValue(sum(values.ordered)!, item.unit, 'purchase_orders'),
      onHand:
        sum(values.onHand) === undefined
          ? null
          : numberValue(sum(values.onHand)!, item.unit, 'inventory_snapshots'),
    }))
}

function buildCategories(input: ContextBundleInput) {
  const categories = new Map<string, ContextBundleItem[]>()
  for (const item of input.items) {
    const name = item.category?.trim() || 'Uncategorized'
    const members = categories.get(name) ?? []
    members.push(item)
    categories.set(name, members)
  }
  return [...categories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, members]) => {
      const sortedMembers = [...members].sort((left, right) =>
        left.id.localeCompare(right.id),
      )
      const itemIds = sortedMembers.map((item) => item.id)
      const totals = [...new Set(sortedMembers.map((item) => item.unit))]
        .sort()
        .map((unit) =>
          distributionValues(
            'all recorded rows',
            unit,
            input.sales.filter(
              (row) =>
                row.itemId !== null &&
                sortedMembers.some(
                  (item) => item.id === row.itemId && item.unit === unit,
                ),
            ),
            input.orders.filter(
              (row) =>
                row.itemId !== null &&
                sortedMembers.some(
                  (item) => item.id === row.itemId && item.unit === unit,
                ),
            ),
            () => true,
            `normalized rows in category:${name}`,
          ),
        )
      return {
        name,
        itemIds,
        itemCount: numberValue(
          String(itemIds.length),
          'items',
          `inventory_items:category:${name}`,
        ),
        totals,
        provenance: 'inventory_items and normalized input rows' as const,
      }
    })
}

function baseBundle(input: ContextBundleInput): ContextBundle {
  const itemMetrics = new Map<string, ContextBundleMetric[]>()
  for (const metric of input.itemMetrics) {
    if (!metric.itemId) continue
    const metrics = itemMetrics.get(metric.itemId) ?? []
    metrics.push(metric)
    itemMetrics.set(metric.itemId, metrics)
  }
  return {
    version: CONTEXT_BUNDLE_VERSION,
    location: { ...input.location, provenance: 'locations' },
    window: {
      start: input.inputWindowStart.toISOString(),
      end: input.inputWindowEnd.toISOString(),
      provenance: 'normalized input rows',
    },
    items: [...input.items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        unit: item.unit,
        series: buildSeries(input, item),
        metrics: sortedMetrics(itemMetrics.get(item.id) ?? []),
        provenance: 'inventory_items and normalized input rows' as const,
      })),
    categories: buildCategories(input),
    distributions: buildDistributions(input),
    metrics: sortedMetrics(input.rollupMetrics),
    compaction: {
      omittedSeriesPoints: numberValue(
        '0',
        'series points',
        'context-bundle compaction',
      ),
      rule: 'oldest series points omitted first',
    },
  }
}

function contextMetricStatus(status: string): ContextBundleMetric['status'] {
  if (status === 'calculated' || status === 'cannot-calculate') return status
  throw new Error(`Unsupported persisted metric status: ${status}`)
}

export function estimateContextBundleTokens(bundle: ContextBundle) {
  return Math.ceil(JSON.stringify(bundle).length / TOKEN_ESTIMATE_CHARS)
}

function compactBundle(bundle: ContextBundle): ContextBundleResult {
  let estimatedTokens = estimateContextBundleTokens(bundle)
  let omitted = 0
  while (estimatedTokens > CONTEXT_BUNDLE_TOKEN_BUDGET) {
    let oldest:
      | { itemIndex: number; pointIndex: number; date: string; itemId: string }
      | undefined
    bundle.items.forEach((item, itemIndex) => {
      const point = item.series[0]
      if (!point) return
      const candidate = {
        itemIndex,
        pointIndex: 0,
        date: point.date.value,
        itemId: item.id,
      }
      if (
        !oldest ||
        `${candidate.date}:${candidate.itemId}` <
          `${oldest.date}:${oldest.itemId}`
      )
        oldest = candidate
    })
    if (!oldest) break
    bundle.items[oldest.itemIndex]?.series.splice(oldest.pointIndex, 1)
    omitted += 1
    bundle.compaction.omittedSeriesPoints = numberValue(
      String(omitted),
      'series points',
      'context-bundle compaction',
    )
    estimatedTokens = estimateContextBundleTokens(bundle)
  }
  return { bundle, estimatedTokens, compacted: omitted > 0 }
}

export function buildContextBundle(
  input: ContextBundleInput,
): ContextBundleResult {
  return compactBundle(baseBundle(input))
}

export async function loadContextBundle(locationId: string) {
  const [location] = await db
    .select({
      id: locations.id,
      name: locations.name,
      timezone: locations.timezone,
      businessDayBoundary: locations.businessDayBoundary,
    })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1)
  if (!location) return null

  const [items, sales, orders, snapshots, run] = await Promise.all([
    db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.displayName,
        category: inventoryItems.category,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.locationId, locationId))
      .orderBy(asc(inventoryItems.id)),
    db
      .select({
        itemId: transactions.menuItemId,
        qty: transactions.qty,
        transactedAt: transactions.transactedAt,
      })
      .from(transactions)
      .where(eq(transactions.locationId, locationId))
      .orderBy(asc(transactions.transactedAt), asc(transactions.id)),
    db
      .select({
        itemId: purchaseOrderItems.inventoryItemId,
        qty: purchaseOrderItems.qty,
        orderedAt: purchaseOrders.orderedAt,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .where(eq(purchaseOrderItems.locationId, locationId))
      .orderBy(asc(purchaseOrders.orderedAt), asc(purchaseOrderItems.id)),
    db
      .select({
        itemId: inventorySnapshots.inventoryItemId,
        qty: inventorySnapshots.qty,
        countedAt: inventorySnapshots.countedAt,
      })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, locationId))
      .orderBy(asc(inventorySnapshots.countedAt), asc(inventorySnapshots.id)),
    db
      .select()
      .from(metricRuns)
      .where(
        and(
          eq(metricRuns.locationId, locationId),
          eq(metricRuns.status, 'succeeded'),
        ),
      )
      .orderBy(desc(metricRuns.completedAt), desc(metricRuns.id))
      .limit(1),
  ])
  if (!run[0]) return null

  const [itemMetricRows, rollupMetricRows] = await Promise.all([
    db
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
          eq(metricResults.locationId, locationId),
          eq(metricResults.runId, run[0].id),
        ),
      )
      .orderBy(
        asc(metricResults.inventoryItemId),
        asc(metricResults.metricKey),
      ),
    db
      .select({
        metricKey: metricRollups.metricKey,
        status: metricRollups.status,
        value: metricRollups.value,
        result: metricRollups.result,
      })
      .from(metricRollups)
      .where(
        and(
          eq(metricRollups.locationId, locationId),
          eq(metricRollups.runId, run[0].id),
        ),
      )
      .orderBy(asc(metricRollups.metricKey)),
  ])

  return buildContextBundle({
    location,
    items,
    sales,
    orders,
    snapshots,
    itemMetrics: itemMetricRows.map((metric) => ({
      ...metric,
      status: contextMetricStatus(metric.status),
      provenance: `metric_results:${metric.metricKey}`,
    })),
    rollupMetrics: rollupMetricRows.map((metric) => ({
      ...metric,
      status: contextMetricStatus(metric.status),
      provenance: `metric_rollups:${metric.metricKey}`,
    })),
    inputWindowStart: run[0].inputWindowStart,
    inputWindowEnd: run[0].inputWindowEnd,
  })
}

export async function loadOwnedContextBundle(
  headers: Headers,
  locationId: string,
) {
  const owned = await requireOwnedLocation(headers, locationId)
  return loadContextBundle(owned.locationId)
}
