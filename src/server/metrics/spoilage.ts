import type { MetricResult } from './definitions'

export type SpoilageMethod = 'snapshot' | 'inferred'

export type SpoilageVariance = {
  start: string
  end: string
  snapshotValue: string
  inferredValue: string
  difference: string
  thresholdPercent: string
}

export type SpoilageFigure = {
  start: string
  end: string
  method: SpoilageMethod
  value: string
  inputs: Record<string, string>
  inferredValue?: string
}

export type SpoilageResolution = {
  method: SpoilageMethod | 'mixed' | null
  fallbackWindowDays: number
  figures: SpoilageFigure[]
  variances: SpoilageVariance[]
}

export type SpoilageResolutionInput = {
  sales: readonly { qty: string; transactedAt: Date }[]
  orders: readonly { qty: string; orderedAt: Date }[]
  snapshots: readonly { qty: string; countedAt: Date }[]
  qtyOnHand?: string
  onHandAt?: Date
  periodStart?: Date
  periodEnd?: Date
  now?: Date
  fallbackWindowDays?: number
}

export type SpoilageResolutionResult = {
  metric: MetricResult<string>
  resolution: SpoilageResolution
}

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const VARIANCE_THRESHOLD_PERCENT = '20'
const DEFAULT_FALLBACK_WINDOW_DAYS = 7

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

function subtract(left: Decimal, right: Decimal) {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
}

function absolute(value: Decimal) {
  return value.coefficient < 0n
    ? { coefficient: -value.coefficient, scale: value.scale }
    : value
}

function sum(values: readonly string[], emptyValue?: string) {
  if (values.length === 0) return emptyValue
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function compare(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale)
  const leftCoefficient = left.coefficient * 10n ** BigInt(scale - left.scale)
  const rightCoefficient =
    right.coefficient * 10n ** BigInt(scale - right.scale)
  return leftCoefficient === rightCoefficient
    ? 0
    : leftCoefficient > rightCoefficient
      ? 1
      : -1
}

function dateKey(date: Date) {
  return date.toISOString()
}

function inPeriod(
  timestamp: Date,
  start: Date,
  end: Date,
  includeStart = false,
) {
  const timestampValue = timestamp.getTime()
  const startValue = start.getTime()
  return (
    (includeStart
      ? timestampValue >= startValue
      : timestampValue > startValue) && timestampValue <= end.getTime()
  )
}

function periodInputs(
  input: SpoilageResolutionInput,
  start: Date,
  end: Date,
  onHand: string | undefined,
  allowEmptyOrders = false,
  includeStart = false,
) {
  const ordered = sum(
    input.orders
      .filter((order) => inPeriod(order.orderedAt, start, end, includeStart))
      .map((order) => order.qty),
    allowEmptyOrders ? '0' : undefined,
  )
  const sold = sum(
    input.sales
      .filter((sale) => inPeriod(sale.transactedAt, start, end, includeStart))
      .map((sale) => sale.qty),
    '0',
  )
  return { ordered, sold, onHand }
}

function inferredValue(inputs: {
  ordered: string | undefined
  sold: string | undefined
  onHand: string | undefined
}) {
  if (!inputs.ordered || !inputs.sold || !inputs.onHand) return undefined
  const ordered = parseDecimal(inputs.ordered)
  const sold = parseDecimal(inputs.sold)
  const onHand = parseDecimal(inputs.onHand)
  if (!ordered || !sold || !onHand) return undefined
  return decimalToString(subtract(subtract(ordered, sold), onHand))
}

function materialVariance(snapshotValue: string, inferred: string) {
  const snapshot = parseDecimal(snapshotValue)
  const inferredValue = parseDecimal(inferred)
  if (!snapshot || !inferredValue) return false
  const difference = absolute(subtract(snapshot, inferredValue))
  const smaller =
    compare(absolute(snapshot), absolute(inferredValue)) <= 0
      ? absolute(snapshot)
      : absolute(inferredValue)
  if (smaller.coefficient === 0n) return difference.coefficient !== 0n
  const threshold = parseDecimal(VARIANCE_THRESHOLD_PERCENT)
  if (!threshold) return false
  return (
    compare(
      { coefficient: difference.coefficient * 100n, scale: difference.scale },
      {
        coefficient: smaller.coefficient * threshold.coefficient,
        scale: smaller.scale + threshold.scale,
      },
    ) > 0
  )
}

function buildVariance(
  start: Date,
  end: Date,
  snapshotValue: string,
  inferred: string,
): SpoilageVariance {
  const snapshot = parseDecimal(snapshotValue) as Decimal
  const inferredValue = parseDecimal(inferred) as Decimal
  return {
    start: dateKey(start),
    end: dateKey(end),
    snapshotValue,
    inferredValue: inferred,
    difference: decimalToString(subtract(snapshot, inferredValue)),
    thresholdPercent: VARIANCE_THRESHOLD_PERCENT,
  }
}

function metricCannotCalculate(
  reason: string,
  inputs: Record<string, string>,
  resolution: SpoilageResolution,
): SpoilageResolutionResult {
  return {
    metric: {
      status: 'cannot-calculate',
      reason,
      inputs,
      units: { value: 'units' },
    },
    resolution,
  }
}

export function resolveSpoilage(
  input: SpoilageResolutionInput,
): SpoilageResolutionResult {
  const fallbackWindowDays =
    input.fallbackWindowDays ?? DEFAULT_FALLBACK_WINDOW_DAYS
  const timestamps = [
    ...input.sales.map((row) => row.transactedAt),
    ...input.orders.map((row) => row.orderedAt),
    ...input.snapshots.map((row) => row.countedAt),
  ]
  const periodEnd = input.periodEnd ?? input.now ?? new Date()
  const periodStart =
    input.periodStart ??
    timestamps.reduce(
      (earliest, timestamp) => (timestamp < earliest ? timestamp : earliest),
      periodEnd,
    )
  const snapshots = [...input.snapshots].sort(
    (left, right) => left.countedAt.getTime() - right.countedAt.getTime(),
  )
  const figures: SpoilageFigure[] = []
  const variances: SpoilageVariance[] = []

  const addInferredFigure = (
    start: Date,
    end: Date,
    onHand: string | undefined,
    onHandAt: Date | undefined,
    includeStart = false,
  ) => {
    if (start.getTime() >= end.getTime()) return
    const isFresh =
      onHand !== undefined &&
      (onHandAt === undefined ||
        end.getTime() - onHandAt.getTime() <=
          fallbackWindowDays * 24 * 60 * 60 * 1000)
    const inputs = periodInputs(
      input,
      start,
      end,
      isFresh ? onHand : undefined,
      false,
      includeStart,
    )
    const value = inferredValue(inputs)
    if (value === undefined) return false
    figures.push({
      start: dateKey(start),
      end: dateKey(end),
      method: 'inferred',
      value,
      inputs: {
        ordered: inputs.ordered as string,
        sold: inputs.sold as string,
        onHand: inputs.onHand as string,
      },
    })
    return true
  }

  if (snapshots.length >= 2) {
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1]
      const current = snapshots[index]
      if (!previous || !current) continue
      const start =
        previous.countedAt < periodStart ? periodStart : previous.countedAt
      const end = current.countedAt > periodEnd ? periodEnd : current.countedAt
      if (start.getTime() >= end.getTime()) continue
      const inputs = periodInputs(input, start, end, current.qty, true)
      if (inputs.ordered === undefined || inputs.sold === undefined) continue
      const beginning = parseDecimal(previous.qty)
      const ordered = parseDecimal(inputs.ordered)
      const sold = parseDecimal(inputs.sold)
      const ending = parseDecimal(current.qty)
      if (!beginning || !ordered || !sold || !ending) continue
      const snapshotValue = decimalToString(
        subtract(subtract(add(beginning, ordered), sold), ending),
      )
      const inferred = inferredValue(inputs)
      figures.push({
        start: dateKey(start),
        end: dateKey(end),
        method: 'snapshot',
        value: snapshotValue,
        inputs: {
          beginningOnHand: previous.qty,
          ordered: inputs.ordered,
          sold: inputs.sold,
          endingOnHand: current.qty,
        },
        ...(inferred === undefined ? {} : { inferredValue: inferred }),
      })
      if (inferred !== undefined && materialVariance(snapshotValue, inferred))
        variances.push(buildVariance(start, end, snapshotValue, inferred))
    }
    const first = snapshots[0]
    const last = snapshots.at(-1)
    if (first && first.countedAt > periodStart)
      addInferredFigure(
        periodStart,
        first.countedAt,
        first.qty,
        first.countedAt,
        true,
      )
    if (last && last.countedAt < periodEnd)
      addInferredFigure(
        periodEnd > last.countedAt ? last.countedAt : periodEnd,
        periodEnd,
        last.qty,
        last.countedAt,
      )
  } else if (snapshots.length === 1) {
    const snapshot = snapshots[0]
    if (snapshot)
      addInferredFigure(
        periodStart,
        periodEnd,
        snapshot.qty,
        snapshot.countedAt,
        true,
      )
  } else {
    addInferredFigure(
      periodStart,
      periodEnd,
      input.qtyOnHand,
      input.onHandAt,
      true,
    )
  }

  if (figures.length === 0) {
    return metricCannotCalculate(
      'cannot calculate, no complete spoilage inputs',
      {},
      { method: null, fallbackWindowDays, figures, variances },
    )
  }

  const value = sum(figures.map((figure) => figure.value))
  if (value === undefined) {
    return metricCannotCalculate(
      'cannot calculate, spoilage inputs are not valid decimals',
      {},
      { method: null, fallbackWindowDays, figures, variances },
    )
  }
  const methods = new Set(figures.map((figure) => figure.method))
  const resolution = {
    method: methods.size === 1 ? ([...methods][0] ?? null) : 'mixed',
    fallbackWindowDays,
    figures,
    variances,
  } satisfies SpoilageResolution
  return {
    metric: {
      status: 'calculated',
      value,
      inputs: { figureCount: String(figures.length) },
      units: { value: 'units' },
    },
    resolution,
  }
}
