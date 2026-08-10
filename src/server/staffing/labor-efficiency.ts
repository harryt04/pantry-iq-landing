import {
  businessDayBucket,
  laborCostPercentage,
  primeCost,
  primeCostPercentage,
  salesPerLaborHour,
  type MetricResult,
} from '@/src/server/metrics/definitions'

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const DAY_PARTS = [
  { key: 'morning', label: 'Morning', start: 0, end: 420 },
  { key: 'midday', label: 'Midday', start: 420, end: 720 },
  { key: 'evening', label: 'Evening', start: 720, end: 1080 },
  { key: 'overnight', label: 'Overnight', start: 1080, end: 1440 },
] as const

type Decimal = { coefficient: bigint; scale: number }

export type LaborEfficiencySale = {
  transactedAt: Date | string
  revenue: string
  totalCost: string | null
}

export type LaborEfficiencyShift = {
  id: string
  shiftStart: Date | string
  shiftEnd: Date | string | null
  role: string
  scheduledHours: string | null
  actualHours: string | null
  laborCost: string | null
}

export type LaborEfficiencyDimension = 'shift' | 'day-part' | 'day-of-week'

export type LaborEfficiencyPeriod = {
  id: string
  dimension: LaborEfficiencyDimension
  label: string
  sales: string | null
  foodCost: string | null
  scheduledHours: string | null
  actualHours: string | null
  laborCost: string | null
  scheduledActualVariance: string | null
  salesPerLaborHour: MetricResult<string>
  laborCostPercentage: MetricResult<string>
  primeCost: MetricResult<string>
  primeCostPercentage: MetricResult<string>
}

export type LaborEfficiencyExclusion = {
  dimension: LaborEfficiencyDimension | 'input'
  period: string
  reason: string
}

export type LaborEfficiencyResult = {
  periods: LaborEfficiencyPeriod[]
  exclusions: LaborEfficiencyExclusion[]
  assumptions: readonly string[]
}

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

function normalize(value: Decimal): Decimal {
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
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

function decimalToString(value: Decimal): string {
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

function sum(values: readonly (string | null)[]): string | null {
  if (values.length === 0 || values.some((value) => value === null)) return null
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value as string)
    if (!parsed) return null
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function difference(actual: string | null, scheduled: string | null) {
  if (actual === null || scheduled === null) return null
  const parsedActual = parseDecimal(actual)
  const parsedScheduled = parseDecimal(scheduled)
  if (!parsedActual || !parsedScheduled) return null
  return decimalToString(
    add(parsedActual, {
      coefficient: -parsedScheduled.coefficient,
      scale: parsedScheduled.scale,
    }),
  )
}

function dateValue(value: Date | string) {
  const result = new Date(value)
  return Number.isNaN(result.getTime()) ? null : result
}

function localParts(timestamp: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(timestamp)
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function boundaryMinutes(boundary: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(boundary)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function dayPart(
  timestamp: Date,
  timezone: string,
  boundary: string,
): (typeof DAY_PARTS)[number] | null {
  const boundaryValue = boundaryMinutes(boundary)
  if (boundaryValue === null) return null
  const local = localParts(timestamp, timezone)
  const relativeMinutes =
    (local.hour * 60 + local.minute - boundaryValue + 1440) % 1440
  return DAY_PARTS.find(
    (part) => relativeMinutes >= part.start && relativeMinutes < part.end,
  )!
}

function dayOfWeek(
  timestamp: Date,
  timezone: string,
  boundary: string,
): string | null {
  const bucket = businessDayBucket({ timestamp, timezone, boundary })
  if (bucket.status !== 'calculated') return null
  const [year, month, day] = bucket.value.split('-').map(Number)
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][weekday]!
}

type Bucket = {
  sales: LaborEfficiencySale[]
  labor: LaborEfficiencyShift[]
}

function addToBucket(
  buckets: Map<string, Bucket>,
  key: string,
  kind: 'sales' | 'labor',
  value: LaborEfficiencySale | LaborEfficiencyShift,
) {
  const bucket = buckets.get(key) ?? { sales: [], labor: [] }
  bucket[kind].push(value as never)
  buckets.set(key, bucket)
}

function periodFromBucket(
  dimension: LaborEfficiencyDimension,
  id: string,
  label: string,
  bucket: Bucket,
): LaborEfficiencyPeriod {
  const sales = sum(bucket.sales.map((sale) => sale.revenue))
  const foodCost =
    bucket.sales.length > 0
      ? sum(bucket.sales.map((sale) => sale.totalCost))
      : null
  const scheduledHours = sum(bucket.labor.map((shift) => shift.scheduledHours))
  const actualHours = sum(bucket.labor.map((shift) => shift.actualHours))
  const laborCost = sum(bucket.labor.map((shift) => shift.laborCost))

  return {
    id,
    dimension,
    label,
    sales,
    foodCost,
    scheduledHours,
    actualHours,
    laborCost,
    scheduledActualVariance: difference(actualHours, scheduledHours),
    salesPerLaborHour: salesPerLaborHour({
      ...(sales === null ? {} : { sales }),
      ...(actualHours === null ? {} : { actualHours }),
    }),
    laborCostPercentage: laborCostPercentage({
      ...(laborCost === null ? {} : { laborCost }),
      ...(sales === null ? {} : { sales }),
    }),
    primeCost: primeCost({
      ...(foodCost === null ? {} : { foodCost }),
      ...(laborCost === null ? {} : { laborCost }),
    }),
    primeCostPercentage: primeCostPercentage({
      ...(foodCost === null ? {} : { foodCost }),
      ...(laborCost === null ? {} : { laborCost }),
      ...(sales === null ? {} : { sales }),
    }),
  }
}

function addMissingDataExclusions(
  dimension: LaborEfficiencyDimension,
  buckets: Map<string, Bucket>,
  exclusions: LaborEfficiencyExclusion[],
) {
  for (const [period, bucket] of buckets) {
    if (bucket.sales.length === 0)
      exclusions.push({
        dimension,
        period,
        reason: 'No sales data for this period.',
      })
    if (bucket.labor.length === 0)
      exclusions.push({
        dimension,
        period,
        reason: 'No labor data for this period.',
      })
  }
}

function buildGroupedPeriods(
  dimension: Exclude<LaborEfficiencyDimension, 'shift'>,
  sales: readonly LaborEfficiencySale[],
  labor: readonly LaborEfficiencyShift[],
  timezone: string,
  boundary: string,
  exclusions: LaborEfficiencyExclusion[],
) {
  const buckets = new Map<string, Bucket>()
  for (const sale of sales) {
    const timestamp = dateValue(sale.transactedAt)
    if (!timestamp) {
      exclusions.push({
        dimension: 'input',
        period: 'sale',
        reason: 'A sale has an invalid timestamp.',
      })
      continue
    }
    const part =
      dimension === 'day-part' ? dayPart(timestamp, timezone, boundary) : null
    const weekday =
      dimension === 'day-of-week'
        ? dayOfWeek(timestamp, timezone, boundary)
        : null
    if (!part && !weekday) {
      exclusions.push({
        dimension: 'input',
        period: 'sale',
        reason: 'A sale could not be assigned to the location boundary.',
      })
      continue
    }
    addToBucket(buckets, part?.key ?? weekday!, 'sales', sale)
  }
  for (const shift of labor) {
    const timestamp = dateValue(shift.shiftStart)
    if (!timestamp) {
      exclusions.push({
        dimension: 'input',
        period: shift.id,
        reason: 'A shift has an invalid start timestamp.',
      })
      continue
    }
    const part =
      dimension === 'day-part' ? dayPart(timestamp, timezone, boundary) : null
    const weekday =
      dimension === 'day-of-week'
        ? dayOfWeek(timestamp, timezone, boundary)
        : null
    if (!part && !weekday) {
      exclusions.push({
        dimension: 'input',
        period: shift.id,
        reason: 'A shift could not be assigned to the location boundary.',
      })
      continue
    }
    addToBucket(buckets, part?.key ?? weekday!, 'labor', shift)
  }

  addMissingDataExclusions(dimension, buckets, exclusions)
  const labels = new Map<string, string>(
    DAY_PARTS.map((part) => [part.key, part.label]),
  )
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.sales.length > 0 && bucket.labor.length > 0)
    .map(([key, bucket]) =>
      periodFromBucket(
        dimension,
        key,
        dimension === 'day-part' ? (labels.get(key) ?? key) : key,
        bucket,
      ),
    )
}

function buildShiftPeriods(
  sales: readonly LaborEfficiencySale[],
  labor: readonly LaborEfficiencyShift[],
  exclusions: LaborEfficiencyExclusion[],
) {
  const buckets = new Map<string, Bucket>()
  const validShifts: Array<{
    shift: LaborEfficiencyShift
    start: Date
    end: Date
  }> = []
  for (const shift of labor) {
    const start = dateValue(shift.shiftStart)
    const end = shift.shiftEnd ? dateValue(shift.shiftEnd) : null
    if (!start || !end || end <= start) {
      exclusions.push({
        dimension: 'shift',
        period: shift.id,
        reason: 'Shift-level metrics need a valid shift end.',
      })
      continue
    }
    validShifts.push({ shift, start, end })
    buckets.set(`shift:${shift.id}`, { sales: [], labor: [shift] })
  }

  for (const sale of sales) {
    const timestamp = dateValue(sale.transactedAt)
    if (!timestamp) {
      exclusions.push({
        dimension: 'input',
        period: 'sale',
        reason: 'A sale has an invalid timestamp.',
      })
      continue
    }
    const matches = validShifts.filter(
      ({ start, end }) => timestamp >= start && timestamp < end,
    )
    if (matches.length === 1) {
      buckets.get(`shift:${matches[0]!.shift.id}`)!.sales.push(sale)
    } else if (matches.length === 0) {
      exclusions.push({
        dimension: 'shift',
        period: 'sale',
        reason: 'Sale is outside every complete shift.',
      })
    } else {
      exclusions.push({
        dimension: 'shift',
        period: 'sale',
        reason:
          'Sale overlaps multiple shifts and was not assigned by assumption.',
      })
    }
  }

  addMissingDataExclusions('shift', buckets, exclusions)
  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.sales.length > 0 && bucket.labor.length > 0)
    .map(([id, bucket]) => {
      const shift = bucket.labor[0]!
      const start = dateValue(shift.shiftStart)!
      return periodFromBucket(
        'shift',
        id,
        `${shift.role} · ${start.toISOString().slice(0, 10)}`,
        bucket,
      )
    })
}

export function buildLaborEfficiencyMetrics(input: {
  sales: readonly LaborEfficiencySale[]
  labor: readonly LaborEfficiencyShift[]
  timezone: string
  businessDayBoundary: string
}): LaborEfficiencyResult {
  const exclusions: LaborEfficiencyExclusion[] = []
  const shiftPeriods = buildShiftPeriods(input.sales, input.labor, exclusions)
  const dayPartPeriods = buildGroupedPeriods(
    'day-part',
    input.sales,
    input.labor,
    input.timezone,
    input.businessDayBoundary,
    exclusions,
  )
  const dayOfWeekPeriods = buildGroupedPeriods(
    'day-of-week',
    input.sales,
    input.labor,
    input.timezone,
    input.businessDayBoundary,
    exclusions,
  )

  return {
    periods: [...shiftPeriods, ...dayPartPeriods, ...dayOfWeekPeriods],
    exclusions,
    assumptions: [
      'Sales are grouped in the location timezone; the configured business-day boundary is applied before day-of-week grouping.',
      'Day parts are relative to the business-day boundary: Morning 0–7 hours, Midday 7–12, Evening 12–18, Overnight 18–24.',
      'A shift owns sales from its inclusive start through its exclusive end. Overlapping or uncovered sales are excluded from shift metrics.',
      'Prime cost uses transaction total cost as food cost and is calculated only when every sale in the period includes total cost.',
      'Actual hours power sales-per-labor-hour; scheduled and actual hours remain separate so their variance is visible.',
    ],
  }
}
