import { and, eq, gte } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  inventorySnapshots,
  locations,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'

import {
  businessDayBucket,
  sellThroughRate,
  spoilageEstimate,
} from './definitions'

type TrendMetric = 'margin' | 'spoilage' | 'sellThrough'

export type TrendPeriod = {
  label: string
  margin?: string
  spoilage?: string
  sellThrough?: string
  unit?: string
}

export type TrendPoint = {
  label: string
  value: string | null
  chartValue: number | null
  valueLabel: string
}

export type TrendSummary = {
  id: TrendMetric
  title: string
  currentValue: string | null
  currentValueLabel: string
  comparisonLabel: string
  direction: 'up' | 'down' | 'flat' | 'unknown'
  directionLabel: string
  points: readonly TrendPoint[]
}

type MetricDefinition = {
  id: TrendMetric
  title: string
  unit: string
  format: (value: string, unit: string) => string
}

const metricDefinitions: readonly MetricDefinition[] = [
  {
    id: 'margin',
    title: 'Margin',
    unit: 'USD',
    format: (value, unit) => `${unit === 'USD' ? '$' : `${unit} `}${value}`,
  },
  {
    id: 'spoilage',
    title: 'Spoilage',
    unit: 'units',
    format: (value, unit) => `${value} ${unit}`,
  },
  {
    id: 'sellThrough',
    title: 'Sell-through',
    unit: '%',
    format: (value) => `${value}%`,
  },
]

function parseDecimal(value: string) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null

  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  return {
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function normalize(value: { coefficient: bigint; scale: number }) {
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function sumDecimalStrings(values: readonly string[]) {
  if (values.length === 0) return undefined
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

  const normalized = normalize({ coefficient, scale })
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

function compareDecimalStrings(left: string, right: string) {
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

function chartValue(value: string | undefined) {
  if (value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function pointLabel(
  period: TrendPeriod,
  value: string | undefined,
  unit: string,
  format: MetricDefinition['format'],
): TrendPoint {
  return {
    label: period.label,
    value: value ?? null,
    chartValue: chartValue(value),
    valueLabel: value === undefined ? 'No data' : format(value, unit),
  }
}

function directionFor(
  current: string | undefined,
  previous: string | undefined,
) {
  if (current === undefined || previous === undefined) {
    return { direction: 'unknown' as const, directionLabel: 'No comparison' }
  }
  const comparison = compareDecimalStrings(current, previous)
  if (comparison === null || comparison === 0) {
    return {
      direction: comparison === 0 ? ('flat' as const) : ('unknown' as const),
      directionLabel: comparison === 0 ? 'Flat' : 'No comparison',
    }
  }
  return comparison > 0
    ? { direction: 'up' as const, directionLabel: 'Up' }
    : { direction: 'down' as const, directionLabel: 'Down' }
}

/**
 * Builds dashboard trend cards from pre-aggregated business-week values.
 * Missing values stay missing: charts receive null points and never get an
 * interpolated value that the imported data cannot support.
 */
export function buildTrendSummaries(
  periods: readonly TrendPeriod[],
): TrendSummary[] {
  return metricDefinitions.map((definition) => {
    const values = periods.map((period) => period[definition.id])
    const current = values.at(-1)
    let previousIndex = values.length - 2
    while (previousIndex >= 0 && values[previousIndex] === undefined)
      previousIndex -= 1
    const previous = previousIndex >= 0 ? values[previousIndex] : undefined
    const direction = directionFor(current, previous)
    const comparisonLabel =
      current === undefined
        ? 'Compared with the previous week when data is available.'
        : previous === undefined
          ? 'No previous week has enough data for comparison.'
          : `Compared with the week of ${periods[previousIndex]?.label ?? 'the previous week'}.`

    return {
      id: definition.id,
      title: definition.title,
      currentValue: current ?? null,
      currentValueLabel: current
        ? definition.format(
            current,
            definition.id === 'spoilage'
              ? (periods.at(-1)?.unit ?? definition.unit)
              : definition.unit,
          )
        : 'Not enough data',
      comparisonLabel,
      ...direction,
      points: periods.map((period) =>
        pointLabel(
          period,
          period[definition.id],
          definition.id === 'spoilage'
            ? (period.unit ?? definition.unit)
            : definition.unit,
          definition.format,
        ),
      ),
    }
  })
}

type WeeklyRows = {
  margin: string[]
  sold: string[]
  ordered: string[]
  onHand: SnapshotPoint[]
  units: Set<string>
}

type SnapshotPoint = { value: string; timestamp: number }

function weekKey(timestamp: Date, timezone: string, boundary: string) {
  const bucket = businessDayBucket({ timestamp, timezone, boundary })
  if (bucket.status !== 'calculated') return undefined
  const date = new Date(`${bucket.value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function formatWeekLabel(week: string) {
  const start = new Date(`${week}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const format = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${format.format(start)}–${format.format(end)}`
}

function addWeeklyRow(
  map: Map<string, WeeklyRows>,
  key: string,
  patch: Partial<WeeklyRows>,
) {
  const row = map.get(key) ?? {
    margin: [],
    sold: [],
    ordered: [],
    onHand: [],
    units: new Set<string>(),
  }
  row.margin.push(...(patch.margin ?? []))
  row.sold.push(...(patch.sold ?? []))
  row.ordered.push(...(patch.ordered ?? []))
  row.onHand.push(...(patch.onHand ?? []))
  for (const unit of patch.units ?? []) row.units.add(unit)
  map.set(key, row)
}

/** Reads only the selected owner's rows and prepares the dashboard trend data. */
export async function getDashboardTrends(headers: Headers, locationId: string) {
  const owned = await requireOwnedLocation(headers, locationId)
  const from = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000)
  const [location, sales, orders, snapshots] = await Promise.all([
    db
      .select({
        timezone: locations.timezone,
        boundary: locations.businessDayBoundary,
      })
      .from(locations)
      .where(eq(locations.id, owned.locationId))
      .limit(1),
    db
      .select({
        transactedAt: transactions.transactedAt,
        qty: transactions.qty,
        grossMargin: transactions.grossMargin,
        unit: inventoryItems.unit,
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(inventoryItems.id, transactions.menuItemId))
      .where(
        and(
          eq(transactions.locationId, owned.locationId),
          gte(transactions.transactedAt, from),
        ),
      ),
    db
      .select({
        orderedAt: purchaseOrders.orderedAt,
        qty: purchaseOrderItems.qty,
        unit: inventoryItems.unit,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.id, purchaseOrderItems.inventoryItemId),
      )
      .where(
        and(
          eq(purchaseOrderItems.locationId, owned.locationId),
          gte(purchaseOrders.orderedAt, from),
        ),
      ),
    db
      .select({
        countedAt: inventorySnapshots.countedAt,
        qty: inventorySnapshots.qty,
        unit: inventoryItems.unit,
      })
      .from(inventorySnapshots)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.id, inventorySnapshots.inventoryItemId),
      )
      .where(
        and(
          eq(inventorySnapshots.locationId, owned.locationId),
          gte(inventorySnapshots.countedAt, from),
        ),
      ),
  ])

  const selectedLocation = location[0]
  if (!selectedLocation) return []
  const weekly = new Map<string, WeeklyRows>()
  for (const sale of sales) {
    const key = weekKey(
      sale.transactedAt,
      selectedLocation.timezone,
      selectedLocation.boundary,
    )
    if (key)
      addWeeklyRow(weekly, key, {
        sold: [sale.qty],
        margin: sale.grossMargin ? [sale.grossMargin] : [],
        units: sale.unit ? new Set([sale.unit]) : new Set(),
      })
  }
  for (const order of orders) {
    const key = weekKey(
      order.orderedAt,
      selectedLocation.timezone,
      selectedLocation.boundary,
    )
    if (key)
      addWeeklyRow(weekly, key, {
        ordered: [order.qty],
        units: order.unit ? new Set([order.unit]) : new Set(),
      })
  }
  for (const snapshot of snapshots) {
    const key = weekKey(
      snapshot.countedAt,
      selectedLocation.timezone,
      selectedLocation.boundary,
    )
    if (key)
      addWeeklyRow(weekly, key, {
        onHand: [
          { value: snapshot.qty, timestamp: snapshot.countedAt.getTime() },
        ],
        units: snapshot.unit ? new Set([snapshot.unit]) : new Set(),
      })
  }

  const keys = [...weekly.keys()].sort()
  const latest = keys.at(-1)
  if (!latest) return []
  const first = new Date(`${latest}T00:00:00Z`)
  first.setUTCDate(first.getUTCDate() - 7 * 7)
  const periods: TrendPeriod[] = []
  for (let index = 0; index < 8; index += 1) {
    const date = new Date(first)
    date.setUTCDate(date.getUTCDate() + index * 7)
    const key = date.toISOString().slice(0, 10)
    const row = weekly.get(key)
    const margin =
      row && row.margin.length === row.sold.length
        ? sumDecimalStrings(row.margin)
        : undefined
    const unit = row && row.units.size === 1 ? [...row.units][0] : undefined
    const sold = row ? sumDecimalStrings(row.sold) : undefined
    const ordered = row ? sumDecimalStrings(row.ordered) : undefined
    const latestSnapshot = row?.onHand.reduce<SnapshotPoint | undefined>(
      (latest, snapshot) =>
        !latest || snapshot.timestamp > latest.timestamp ? snapshot : latest,
      undefined,
    )
    const onHand = latestSnapshot?.value
    const sellThroughResult =
      sold && ordered
        ? sellThroughRate({ qtySold: sold, qtyOrdered: ordered })
        : undefined
    const spoilageResult =
      sold && ordered && onHand
        ? spoilageEstimate({
            qtySold: sold,
            qtyOrdered: ordered,
            qtyOnHand: onHand,
          })
        : undefined
    const sellThrough =
      sellThroughResult?.status === 'calculated'
        ? sellThroughResult.value
        : undefined
    const spoilage =
      spoilageResult?.status === 'calculated' ? spoilageResult.value : undefined
    const period: TrendPeriod = {
      label: formatWeekLabel(key),
      unit: unit ?? 'units',
    }
    if (margin !== undefined) period.margin = margin
    if (unit && sellThrough !== undefined) period.sellThrough = sellThrough
    if (unit && spoilage !== undefined) period.spoilage = spoilage
    periods.push(period)
  }
  return buildTrendSummaries(periods)
}
