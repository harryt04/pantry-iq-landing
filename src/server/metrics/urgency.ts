import type { MetricResult } from './definitions'
import { METRICS_CONFIG } from './config'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Thresholds and weights are deliberately exported as a configuration seam.
 * MET-08 can replace this object without changing the urgency contract.
 */
export const URGENCY_DEFAULTS = METRICS_CONFIG.urgency

export type UrgencyOptions = {
  weights?: Partial<{
    shelfLife: number
    trendAcceleration: number
    supplierLeadTime: number
  }>
  highUrgencyDays?: number
  mediumUrgencyDays?: number
  lowUrgencyDays?: number
  minimumTrendHistoryWeeks?: number
  trendWindowDays?: number
}

export type UrgencyOrder = {
  orderedAt: Date
  receivedAt?: Date | null
}

export type UrgencyInput = {
  shelfLifeDays?: number | null
  freshnessAnchorAt?: Date
  sales?: readonly { qty: string; transactedAt: Date }[]
  orders?: readonly UrgencyOrder[]
  now?: Date
}

export type UrgencyComponent = {
  status: 'calculated' | 'suppressed'
  score: string
  inputs: Record<string, string>
  reason?: string
}

export type UrgencyMetricResult = Extract<
  MetricResult<string>,
  { status: 'calculated' }
> & {
  components: {
    shelfLife: UrgencyComponent
    trendAcceleration: UrgencyComponent
    supplierLeadTime: UrgencyComponent
  }
  thresholds: {
    lowUrgencyDays: number
    highUrgencyDays: number
    mediumUrgencyDays: number
    minimumTrendHistoryWeeks: number
  }
  weights: Record<keyof typeof URGENCY_DEFAULTS.weights, number>
}

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const PERCENT_SCALE = 2

function parseDecimal(value: string): Decimal | undefined {
  if (!DECIMAL_PATTERN.test(value)) return undefined
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integerPart = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integerPart}${fraction}`.replace(/^0+(?=\d)/, '')
  return {
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function normalize(decimal: Decimal): Decimal {
  if (decimal.coefficient === 0n) return { coefficient: 0n, scale: 0 }
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

function subtract(left: Decimal, right: Decimal): Decimal {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
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

function validWeight(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback
}

function validThreshold(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback
}

function resolveConfig(options: UrgencyOptions) {
  const lowUrgencyDays = validThreshold(
    options.lowUrgencyDays,
    URGENCY_DEFAULTS.lowUrgencyDays,
  )
  const highUrgencyDays = Math.max(
    lowUrgencyDays,
    validThreshold(options.highUrgencyDays, URGENCY_DEFAULTS.highUrgencyDays),
  )
  const mediumUrgencyDays = Math.max(
    highUrgencyDays,
    validThreshold(
      options.mediumUrgencyDays,
      URGENCY_DEFAULTS.mediumUrgencyDays,
    ),
  )

  return {
    weights: {
      shelfLife: validWeight(
        options.weights?.shelfLife,
        URGENCY_DEFAULTS.weights.shelfLife,
      ),
      trendAcceleration: validWeight(
        options.weights?.trendAcceleration,
        URGENCY_DEFAULTS.weights.trendAcceleration,
      ),
      supplierLeadTime: validWeight(
        options.weights?.supplierLeadTime,
        URGENCY_DEFAULTS.weights.supplierLeadTime,
      ),
    },
    lowUrgencyDays,
    highUrgencyDays,
    mediumUrgencyDays,
    minimumTrendHistoryWeeks: Math.max(
      1,
      validThreshold(
        options.minimumTrendHistoryWeeks,
        URGENCY_DEFAULTS.minimumTrendHistoryWeeks,
      ),
    ),
    trendWindowDays: Math.max(
      1,
      validThreshold(options.trendWindowDays, URGENCY_DEFAULTS.trendWindowDays),
    ),
  }
}

function component(
  score: string,
  inputs: Record<string, string>,
  reason?: string,
): UrgencyComponent {
  return reason
    ? { status: 'suppressed', score, inputs, reason }
    : { status: 'calculated', score, inputs }
}

function shelfLifeComponent(
  input: UrgencyInput,
  config: ReturnType<typeof resolveConfig>,
  now: Date,
) {
  const inputs: Record<string, string> = {}
  if (input.shelfLifeDays !== undefined && input.shelfLifeDays !== null)
    inputs.shelfLifeDays = String(input.shelfLifeDays)
  if (input.freshnessAnchorAt)
    inputs.freshnessAnchorAt = input.freshnessAnchorAt.toISOString()

  if (
    input.shelfLifeDays === undefined ||
    input.shelfLifeDays === null ||
    !Number.isSafeInteger(input.shelfLifeDays) ||
    input.shelfLifeDays < 0
  ) {
    return component(
      '0',
      inputs,
      'cannot calculate urgency, no shelf life is set',
    )
  }
  if (
    !input.freshnessAnchorAt ||
    !Number.isFinite(input.freshnessAnchorAt.getTime())
  )
    return component(
      '0',
      inputs,
      'cannot calculate urgency, no freshness date is available',
    )

  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - input.freshnessAnchorAt.getTime()) / DAY_MS),
  )
  const remainingDays = Math.max(0, input.shelfLifeDays - elapsedDays)
  inputs.elapsedDays = String(elapsedDays)
  inputs.remainingDays = String(remainingDays)

  const score =
    remainingDays <= config.lowUrgencyDays
      ? '100'
      : remainingDays <= config.highUrgencyDays
        ? '75'
        : remainingDays <= config.mediumUrgencyDays
          ? '50'
          : '0'
  return component(score, inputs)
}

function validSales(input: UrgencyInput) {
  return (input.sales ?? [])
    .filter(
      (sale) =>
        Number.isFinite(sale.transactedAt.getTime()) &&
        parseDecimal(sale.qty) !== undefined,
    )
    .sort(
      (left, right) =>
        left.transactedAt.getTime() - right.transactedAt.getTime(),
    )
}

function trendComponent(
  input: UrgencyInput,
  config: ReturnType<typeof resolveConfig>,
) {
  const sales = validSales(input)
  const first = sales[0]
  const last = sales.at(-1)
  const minimumHistoryDays = config.minimumTrendHistoryWeeks * 7
  const inputs: Record<string, string> = {
    transactionCount: String(sales.length),
    minimumHistoryWeeks: String(config.minimumTrendHistoryWeeks),
  }
  if (first && last) {
    inputs.historyDays = String(
      Math.floor(
        (last.transactedAt.getTime() - first.transactedAt.getTime()) / DAY_MS,
      ),
    )
    inputs.periodEnd = last.transactedAt.toISOString()
  }
  if (
    !first ||
    !last ||
    last.transactedAt.getTime() - first.transactedAt.getTime() <
      minimumHistoryDays * DAY_MS
  ) {
    return component(
      '0',
      inputs,
      `trend acceleration requires ${config.minimumTrendHistoryWeeks} weeks of history`,
    )
  }

  const end = last.transactedAt.getTime()
  const recentStart = end - config.trendWindowDays * DAY_MS
  const priorStart = end - config.trendWindowDays * 2 * DAY_MS
  const priorSales = sales.filter((sale) => {
    const timestamp = sale.transactedAt.getTime()
    return timestamp >= priorStart && timestamp < recentStart
  })
  const recentSales = sales.filter(
    (sale) => sale.transactedAt.getTime() >= recentStart,
  )
  if (priorSales.length === 0 || recentSales.length === 0) {
    return component(
      '0',
      inputs,
      'trend acceleration requires activity in two comparable weeks',
    )
  }

  let priorQty: Decimal = { coefficient: 0n, scale: 0 }
  let recentQty: Decimal = { coefficient: 0n, scale: 0 }
  for (const sale of priorSales) {
    const qty = parseDecimal(sale.qty) as Decimal
    priorQty = add(priorQty, qty)
  }
  for (const sale of recentSales) {
    const qty = parseDecimal(sale.qty) as Decimal
    recentQty = add(recentQty, qty)
  }
  inputs.priorQuantity = decimalToString(priorQty)
  inputs.recentQuantity = decimalToString(recentQty)

  if (priorQty.coefficient === 0n) {
    return component(
      recentQty.coefficient > 0n ? '50' : '0',
      inputs,
      recentQty.coefficient > 0n
        ? 'prior-week quantity was zero; acceleration is conservatively capped'
        : undefined,
    )
  }
  const change = subtract(recentQty, priorQty)
  if (change.coefficient <= 0n) return component('0', inputs)

  const accelerationPercent = divide(
    {
      coefficient: change.coefficient * 100n,
      scale: change.scale,
    },
    priorQty,
    PERCENT_SCALE,
  )
  const percentage = decimalToString(accelerationPercent)
  inputs.accelerationPercent = percentage
  const parsedPercentage = parseDecimal(percentage) as Decimal
  return component(
    parsedPercentage.coefficient > 100n * 10n ** BigInt(parsedPercentage.scale)
      ? '100'
      : decimalToString(
          divide(parsedPercentage, { coefficient: 1n, scale: 0 }, 0),
        ),
    inputs,
  )
}

function supplierLeadTimeComponent(
  input: UrgencyInput,
  config: ReturnType<typeof resolveConfig>,
) {
  const validOrders = (input.orders ?? []).filter((order) => {
    const orderedAt = order.orderedAt.getTime()
    const receivedAt = order.receivedAt?.getTime()
    return (
      Number.isFinite(orderedAt) &&
      receivedAt !== undefined &&
      Number.isFinite(receivedAt) &&
      receivedAt >= orderedAt
    )
  })
  if (validOrders.length === 0)
    return component(
      '0',
      {},
      'cannot calculate urgency, no completed supplier lead time is available',
    )

  const leadTimeDays = Math.round(
    validOrders.reduce((total, order) => {
      const elapsed =
        (order.receivedAt as Date).getTime() - order.orderedAt.getTime()
      return total + Math.max(0, elapsed / DAY_MS)
    }, 0) / validOrders.length,
  )
  const score =
    leadTimeDays <= config.lowUrgencyDays
      ? '0'
      : leadTimeDays <= config.highUrgencyDays
        ? '50'
        : leadTimeDays <= config.mediumUrgencyDays
          ? '75'
          : '100'
  return component(score, {
    completedOrderCount: String(validOrders.length),
    averageLeadTimeDays: String(leadTimeDays),
  })
}

function inputsOf(input: UrgencyInput, now: Date) {
  return {
    ...(input.shelfLifeDays === undefined || input.shelfLifeDays === null
      ? {}
      : { shelfLifeDays: String(input.shelfLifeDays) }),
    ...(input.freshnessAnchorAt
      ? { freshnessAnchorAt: input.freshnessAnchorAt.toISOString() }
      : {}),
    now: now.toISOString(),
  }
}

export function calculateUrgency(
  input: UrgencyInput,
  options: UrgencyOptions = {},
): UrgencyMetricResult {
  const config = resolveConfig(options)
  const now = input.now ?? new Date()
  const components = {
    shelfLife: shelfLifeComponent(input, config, now),
    trendAcceleration: trendComponent(input, config),
    supplierLeadTime: supplierLeadTimeComponent(input, config),
  }
  const weightTotal =
    config.weights.shelfLife +
    config.weights.trendAcceleration +
    config.weights.supplierLeadTime
  const weightedTotal =
    BigInt(components.shelfLife.score) * BigInt(config.weights.shelfLife) +
    BigInt(components.trendAcceleration.score) *
      BigInt(config.weights.trendAcceleration) +
    BigInt(components.supplierLeadTime.score) *
      BigInt(config.weights.supplierLeadTime)
  const value =
    weightTotal > 0
      ? decimalToString(
          divide(
            { coefficient: weightedTotal, scale: 0 },
            { coefficient: BigInt(weightTotal), scale: 0 },
            0,
          ),
        )
      : '0'

  return {
    status: 'calculated',
    value,
    inputs: {
      ...inputsOf(input, now),
      weightTotal: String(weightTotal),
    },
    units: {
      value: 'score',
      shelfLifeDays: 'days',
      remainingDays: 'days',
      averageLeadTimeDays: 'days',
      accelerationPercent: '%',
    },
    components,
    thresholds: {
      lowUrgencyDays: config.lowUrgencyDays,
      highUrgencyDays: config.highUrgencyDays,
      mediumUrgencyDays: config.mediumUrgencyDays,
      minimumTrendHistoryWeeks: config.minimumTrendHistoryWeeks,
    },
    weights: config.weights,
  }
}

/** A location score is the most urgent item, never the sum of item scores. */
export function rollupUrgency(
  results: readonly UrgencyMetricResult[],
): MetricResult<string> {
  const calculated = results.filter(
    (result): result is UrgencyMetricResult & { value: string } =>
      result.status === 'calculated' && result.value !== null,
  )
  if (calculated.length === 0) {
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, no item urgency scores are available',
      inputs: { itemCount: String(results.length) },
      units: { value: 'score' },
    }
  }
  const highest = calculated.reduce((current, result) => {
    const currentValue = parseDecimal(current.value) as Decimal
    const resultValue = parseDecimal(result.value) as Decimal
    const scale = Math.max(currentValue.scale, resultValue.scale)
    const currentCoefficient =
      currentValue.coefficient * 10n ** BigInt(scale - currentValue.scale)
    const resultCoefficient =
      resultValue.coefficient * 10n ** BigInt(scale - resultValue.scale)
    return resultCoefficient > currentCoefficient ? result : current
  })
  return {
    status: 'calculated',
    value: highest.value,
    inputs: {
      itemCount: String(results.length),
      calculatedItemCount: String(calculated.length),
      highestItemScore: highest.value,
    },
    units: { value: 'score' },
  }
}
