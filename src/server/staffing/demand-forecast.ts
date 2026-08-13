import type {
  EvidenceCalculation,
  EvidenceSourceInput,
  EvidenceTrace,
} from '@/src/server/metrics/evidence'
import {
  evaluateExternalSignals,
  signalGroupKey,
  type ExternalSignalInfluence,
  type ExternalSignalInput,
} from './external-signals'

export const MIN_HISTORY_DAYS = 28
const MIN_REFERENCE_PERIODS = 2
const FORECAST_DAYS = 7
const MAX_REFERENCE_PERIODS = 8
const RATIO_SCALE = 6

type Decimal = { coefficient: bigint; scale: number }

export type DemandForecastSale = {
  transactedAt: Date | string
  qty: string
  revenue: string
}

export type DemandForecastInput = {
  timezone: string
  businessDayBoundary: string
  sales: readonly DemandForecastSale[]
  asOf?: Date
  sources?: readonly EvidenceSourceInput[]
  externalSignals?: readonly ExternalSignalInput[]
}

export type ForecastMetric = {
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  reason?: string
  units: string
}

export type DemandForecastPeriod = {
  id: string
  businessDate: string
  dayOfWeek: string
  dayPart: string
  basis: string
  referencePeriods: number
  covers: ForecastMetric
  sales: ForecastMetric
}

export type DemandForecastAccuracy = {
  status: 'calculated' | 'cannot-calculate'
  observations: number
  coversMae: string | null
  salesMae: string | null
  coversMape: string | null
  salesMape: string | null
  reason?: string
}

export type DemandForecastResult = {
  status: 'calculated' | 'suppressed'
  method: string
  historyRequirement: string
  historyDays: number
  periods: DemandForecastPeriod[]
  accuracy: DemandForecastAccuracy
  trace: EvidenceTrace
  externalSignals: ExternalSignalInfluence
  reason?: string
}

type Bucket = {
  date: string
  dayOfWeek: string
  dayPart: string
  covers: string
  sales: string
}

type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const DAY_PARTS = [
  { key: 'morning', label: 'Morning', start: 0, end: 420 },
  { key: 'midday', label: 'Midday', start: 420, end: 720 },
  { key: 'evening', label: 'Evening', start: 720, end: 1080 },
  { key: 'overnight', label: 'Overnight', start: 1080, end: 1440 },
] as const

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

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

function subtract(left: Decimal, right: Decimal): Decimal {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
}

function absolute(value: Decimal): Decimal {
  return value.coefficient < 0n
    ? { coefficient: -value.coefficient, scale: value.scale }
    : value
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
  const remainder = absoluteNumerator % absoluteDenominator
  if (remainder * 2n >= absoluteDenominator) quotient += 1n
  return normalize({ coefficient: negative ? -quotient : quotient, scale })
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

function sum(values: readonly string[]): string | null {
  if (values.length === 0) return null
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return null
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function dateValue(value: Date | string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function localParts(timestamp: Date, timezone: string): LocalParts | null {
  try {
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
  } catch {
    return null
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

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function businessDate(timestamp: Date, timezone: string, boundary: number) {
  const local = localParts(timestamp, timezone)
  if (!local) return null
  const date = `${local.year.toString().padStart(4, '0')}-${local.month
    .toString()
    .padStart(2, '0')}-${local.day.toString().padStart(2, '0')}`
  return local.hour * 60 + local.minute < boundary ? previousDate(date) : date
}

function dayOfWeek(date: string) {
  const value = new Date(`${date}T00:00:00Z`).getUTCDay()
  return WEEKDAYS[value] ?? 'Unknown'
}

function dayPart(
  timestamp: Date,
  timezone: string,
  boundary: number,
): (typeof DAY_PARTS)[number] | null {
  const local = localParts(timestamp, timezone)
  if (!local) return null
  const relativeMinutes =
    (local.hour * 60 + local.minute - boundary + 1440) % 1440
  return (
    DAY_PARTS.find(
      (part) => relativeMinutes >= part.start && relativeMinutes < part.end,
    ) ?? null
  )
}

function addDateDays(date: string, days: number) {
  let result = date
  for (let index = 0; index < days; index += 1) result = nextDate(result)
  return result
}

function average(values: readonly string[]) {
  const total = sum(values)
  if (total === null) return null
  return decimalToString(
    divide(
      parseDecimal(total) as Decimal,
      { coefficient: BigInt(values.length), scale: 0 },
      RATIO_SCALE,
    ),
  )
}

function metric(
  value: string | null,
  units: string,
  reason: string,
): ForecastMetric {
  return value === null
    ? { status: 'cannot-calculate', value: null, units, reason }
    : { status: 'calculated', value, units }
}

function forecastFor(
  date: string,
  dayPartKey: string,
  buckets: readonly Bucket[],
  signalContext?: {
    signals: readonly ExternalSignalInput[]
    qualifiedKeys: ReadonlySet<string>
  },
): {
  covers: string | null
  sales: string | null
  references: number
  conditioned: boolean
} {
  const weekday = dayOfWeek(date)
  const baseReferences = buckets
    .filter(
      (bucket) =>
        bucket.date < date &&
        bucket.dayOfWeek === weekday &&
        bucket.dayPart === dayPartKey,
    )
    .slice(-MAX_REFERENCE_PERIODS)
  const targetSignals = signalContext?.signals.filter(
    (signal) =>
      signal.businessDate === date &&
      signalContext.qualifiedKeys.has(signalGroupKey(signal)),
  )
  const conditionedReferences =
    targetSignals && targetSignals.length > 0
      ? baseReferences.filter((reference) =>
          targetSignals.some((target) =>
            signalContext?.signals.some(
              (signal) =>
                signal.businessDate === reference.date &&
                signalGroupKey(signal) === signalGroupKey(target) &&
                signal.condition === target.condition,
            ),
          ),
        )
      : []
  const conditioned = conditionedReferences.length >= MIN_REFERENCE_PERIODS
  const references = conditioned ? conditionedReferences : baseReferences
  if (references.length < MIN_REFERENCE_PERIODS)
    return {
      covers: null,
      sales: null,
      references: references.length,
      conditioned,
    }
  return {
    covers: average(references.map((reference) => reference.covers)),
    sales: average(references.map((reference) => reference.sales)),
    references: references.length,
    conditioned,
  }
}

function absoluteError(actual: string, predicted: string) {
  const actualDecimal = parseDecimal(actual)
  const predictedDecimal = parseDecimal(predicted)
  if (!actualDecimal || !predictedDecimal) return null
  return decimalToString(absolute(subtract(actualDecimal, predictedDecimal)))
}

function percentageError(actual: string, predicted: string) {
  const actualDecimal = parseDecimal(actual)
  const predictedDecimal = parseDecimal(predicted)
  if (!actualDecimal || !predictedDecimal || actualDecimal.coefficient === 0n)
    return null
  return decimalToString(
    divide(
      absolute(subtract(actualDecimal, predictedDecimal)),
      actualDecimal,
      RATIO_SCALE,
    ),
  )
}

function accuracyFor(
  buckets: readonly Bucket[],
  historyDates: readonly string[],
  signalContext?: {
    signals: readonly ExternalSignalInput[]
    qualifiedKeys: ReadonlySet<string>
  },
) {
  const targetDates = historyDates.slice(-7)
  const coversErrors: string[] = []
  const salesErrors: string[] = []
  const coversPercentErrors: string[] = []
  const salesPercentErrors: string[] = []

  for (const date of targetDates) {
    for (const part of DAY_PARTS) {
      const actual = buckets.find(
        (bucket) => bucket.date === date && bucket.dayPart === part.key,
      )
      if (!actual) continue
      const forecast = forecastFor(
        date,
        part.key,
        buckets.filter((bucket) => bucket.date < date),
        signalContext,
      )
      if (forecast.covers === null || forecast.sales === null) continue
      const coversError = absoluteError(actual.covers, forecast.covers)
      const salesError = absoluteError(actual.sales, forecast.sales)
      const coversPercentError = percentageError(actual.covers, forecast.covers)
      const salesPercentError = percentageError(actual.sales, forecast.sales)
      if (coversError !== null) coversErrors.push(coversError)
      if (salesError !== null) salesErrors.push(salesError)
      if (coversPercentError !== null)
        coversPercentErrors.push(coversPercentError)
      if (salesPercentError !== null) salesPercentErrors.push(salesPercentError)
    }
  }

  if (coversErrors.length === 0 || salesErrors.length === 0) {
    return {
      status: 'cannot-calculate' as const,
      observations: 0,
      coversMae: null,
      salesMae: null,
      coversMape: null,
      salesMape: null,
      reason: 'accuracy needs at least two prior same-weekday periods',
    }
  }
  return {
    status: 'calculated' as const,
    observations: coversErrors.length,
    coversMae: average(coversErrors),
    salesMae: average(salesErrors),
    coversMape: average(coversPercentErrors),
    salesMape: average(salesPercentErrors),
  }
}

function traceFor(
  input: DemandForecastInput,
  periods: readonly DemandForecastPeriod[],
  accuracy: DemandForecastAccuracy,
  externalSignals: ExternalSignalInfluence,
): EvidenceTrace {
  const asOf = input.asOf ?? new Date()
  const calculations: EvidenceCalculation[] = periods.flatMap((period) => {
    if (period.covers.value === null || period.sales.value === null) return []
    const calculation: EvidenceCalculation = {
      id: `forecast:${period.id}`,
      operator: 'mean of the latest same-weekday, same-day-part periods',
      inputs: {
        referencePeriods: String(period.referencePeriods),
        weekday: period.dayOfWeek,
        dayPart: period.dayPart,
      },
      units: { covers: 'imported transaction quantity', sales: 'currency' },
      result: `covers=${period.covers.value}; sales=${period.sales.value}`,
      explanation: period.basis,
    }
    const calculationsForPeriod = [calculation]
    if (period.basis.includes('demonstrated external-signal condition')) {
      calculationsForPeriod.push({
        id: `external-signal:influence:${period.id}`,
        operator:
          'select prior periods matching a demonstrated external-signal condition',
        inputs: { businessDate: period.businessDate },
        units: { result: 'conditioned forecast history' },
        result: String(period.referencePeriods),
        explanation:
          'Only correlation-qualified signal conditions can change the comparable history set.',
      })
    }
    return calculationsForPeriod
  })
  if (accuracy.status === 'calculated') {
    calculations.push({
      id: 'forecast:accuracy',
      operator:
        'mean absolute error and mean absolute percentage error against held-out actuals',
      inputs: { observations: String(accuracy.observations) },
      units: {
        coversMae: 'imported transaction quantity',
        salesMae: 'currency',
        coversMape: '%',
        salesMape: '%',
      },
      result: `coversMae=${accuracy.coversMae}; salesMae=${accuracy.salesMae}; coversMape=${accuracy.coversMape}; salesMape=${accuracy.salesMape}`,
    })
  }
  calculations.push(...externalSignals.traceCalculations)
  return {
    version: 1,
    sources: [
      ...(input.sources
        ? input.sources.map((source) => ({
            ...source,
            uploadedAt: source.uploadedAt.toISOString(),
          }))
        : [
            {
              filename: 'normalized transaction records',
              source: 'transactions',
              rowCount: input.sales.length,
              uploadedAt: asOf.toISOString(),
            },
          ]),
      ...externalSignals.sources.map((source) => ({
        ...source,
        uploadedAt: source.uploadedAt.toISOString(),
      })),
    ],
    calculations,
    assumptions: [
      {
        name: 'forecast.method',
        value:
          'trailing mean of up to eight same-weekday, same-day-part periods',
        origin: 'system-default',
        editPath: 'deployment configuration: demand forecast',
      },
      {
        name: 'forecast.minimumHistoryDays',
        value: String(MIN_HISTORY_DAYS),
        origin: 'system-default',
        editPath: 'deployment configuration: demand forecast',
      },
      {
        name: 'forecast.transactionQuantityMeaning',
        value:
          'covers or units as supplied by the source export; no cover conversion is inferred',
        origin: 'system-default',
        editPath: 'Import → column mapping',
      },
    ],
  }
}

export function buildDemandForecast(
  input: DemandForecastInput,
): DemandForecastResult {
  const asOf = input.asOf ?? new Date()
  const boundary = boundaryMinutes(input.businessDayBoundary)
  const method =
    'Trailing mean of up to eight same-weekday, same-day-part periods.'
  const historyRequirement =
    'At least 28 distinct business days of transaction history.'
  const externalSignalRows = input.externalSignals ?? []

  if (boundary === null) {
    const accuracy: DemandForecastAccuracy = {
      status: 'cannot-calculate',
      observations: 0,
      coversMae: null,
      salesMae: null,
      coversMape: null,
      salesMape: null,
      reason: 'the location business-day boundary is invalid',
    }
    return {
      status: 'suppressed',
      method,
      historyRequirement,
      historyDays: 0,
      periods: [],
      accuracy,
      externalSignals: evaluateExternalSignals(externalSignalRows, []),
      trace: traceFor(
        input,
        [],
        accuracy,
        evaluateExternalSignals(externalSignalRows, []),
      ),
      ...(accuracy.reason ? { reason: accuracy.reason } : {}),
    }
  }

  const buckets = new Map<string, Bucket>()
  for (const sale of input.sales) {
    const timestamp = dateValue(sale.transactedAt)
    const covers = parseDecimal(sale.qty)
    const sales = parseDecimal(sale.revenue)
    if (!timestamp || !covers || !sales) continue
    const date = businessDate(timestamp, input.timezone, boundary)
    const part = dayPart(timestamp, input.timezone, boundary)
    if (!date || !part) continue
    const id = `${date}:${part.key}`
    const existing = buckets.get(id)
    const current: Bucket = existing ?? {
      date,
      dayOfWeek: dayOfWeek(date),
      dayPart: part.key,
      covers: '0',
      sales: '0',
    }
    const nextCovers = add(parseDecimal(current.covers) as Decimal, covers)
    const nextSales = add(parseDecimal(current.sales) as Decimal, sales)
    buckets.set(id, {
      ...current,
      covers: decimalToString(nextCovers),
      sales: decimalToString(nextSales),
    })
  }

  const bucketRows = [...buckets.values()].sort((left, right) =>
    `${left.date}:${left.dayPart}`.localeCompare(
      `${right.date}:${right.dayPart}`,
    ),
  )
  const historyDates = [
    ...new Set(bucketRows.map((bucket) => bucket.date)),
  ].sort()
  const dailySales = historyDates.map((date) => {
    let total: Decimal = { coefficient: 0n, scale: 0 }
    for (const bucket of bucketRows.filter((row) => row.date === date)) {
      total = add(total, parseDecimal(bucket.sales) as Decimal)
    }
    return { businessDate: date, sales: decimalToString(total) }
  })
  const externalSignals = evaluateExternalSignals(
    externalSignalRows,
    dailySales,
  )
  const signalContext = {
    signals: externalSignalRows,
    qualifiedKeys: new Set(
      externalSignals.correlations
        .filter((result) => result.qualified)
        .map((result) => result.key),
    ),
  }
  const accuracy = accuracyFor(bucketRows, historyDates, signalContext)
  if (historyDates.length < MIN_HISTORY_DAYS) {
    return {
      status: 'suppressed',
      method,
      historyRequirement,
      historyDays: historyDates.length,
      periods: [],
      accuracy,
      externalSignals,
      trace: traceFor(input, [], accuracy, externalSignals),
      reason: `forecast suppressed until ${MIN_HISTORY_DAYS} distinct business days are available`,
    }
  }

  const today = businessDate(asOf, input.timezone, boundary)
  if (!today) {
    return {
      status: 'suppressed',
      method,
      historyRequirement,
      historyDays: historyDates.length,
      periods: [],
      accuracy,
      externalSignals,
      trace: traceFor(input, [], accuracy, externalSignals),
      reason: 'forecast date could not be calculated for the location timezone',
    }
  }

  const periods: DemandForecastPeriod[] = []
  for (let day = 1; day <= FORECAST_DAYS; day += 1) {
    const date = addDateDays(today, day)
    for (const part of DAY_PARTS) {
      const forecast = forecastFor(date, part.key, bucketRows, signalContext)
      const reason =
        forecast.references < MIN_REFERENCE_PERIODS
          ? 'not enough same-weekday, same-day-part history'
          : 'reference history is present'
      periods.push({
        id: `${date}:${part.key}`,
        businessDate: date,
        dayOfWeek: dayOfWeek(date),
        dayPart: part.label,
        basis: `${forecast.references} prior ${dayOfWeek(date)} ${part.label.toLowerCase()} periods${forecast.conditioned ? ' with a demonstrated external-signal condition' : ''}`,
        referencePeriods: forecast.references,
        covers: metric(
          forecast.covers,
          'imported transaction quantity',
          reason,
        ),
        sales: metric(forecast.sales, 'currency', reason),
      })
    }
  }

  return {
    status: 'calculated',
    method,
    historyRequirement,
    historyDays: historyDates.length,
    periods,
    accuracy,
    externalSignals,
    trace: traceFor(input, periods, accuracy, externalSignals),
  }
}
