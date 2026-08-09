import type { MetricResult } from './definitions'

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * Impact weights are configuration-shaped integers so the calculation can
 * stay exact until the final 0–100 score. MET-08 can replace this source
 * without changing the metric contract.
 */
export const IMPACT_DEFAULTS = {
  weights: {
    currentSpoilage: 40,
    overordering: 25,
    marginLoss: 20,
    historicalSpoilage: 15,
  },
  highImpactDollars: '100',
  unitSignalScale: '10',
} as const

export type ImpactWeights = Partial<{
  currentSpoilage: number
  overordering: number
  marginLoss: number
  historicalSpoilage: number
}>

export type ImpactOptions = {
  weights?: ImpactWeights
  highImpactDollars?: string
  unitSignalScale?: string
}

export type ImpactInput = {
  qtyOnHand?: string
  historicalSpoilageQty?: string
  qtyOrdered?: string
  qtySold?: string
  revenue?: string
  costOfSales?: string
  unitCost?: string
  unit?: string
  currency?: string
}

export type ImpactCategoryKey = keyof typeof IMPACT_DEFAULTS.weights

export type ImpactCategory = {
  status: 'calculated' | 'suppressed'
  value: string | null
  score: string
  scoreBasis: 'dollars' | 'units' | 'none'
  unitSignal?: string
  inputs: Record<string, string>
  reason?: string
}

export type ImpactMetricResult = MetricResult<string> & {
  categories: Record<ImpactCategoryKey, ImpactCategory>
  dollarsAvailable: boolean
  dollarReason?: string
  weights: Record<ImpactCategoryKey, number>
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

function parseDecimal(value: string): Decimal | undefined {
  if (!DECIMAL_PATTERN.test(value)) return undefined
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integerPart = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integerPart}${fraction}`.replace(/^0+(?=\d)/, '')
  return normalize({
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  })
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

function subtract(left: Decimal, right: Decimal) {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
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

function sum(values: readonly (string | undefined)[]): string | undefined {
  if (values.length === 0) return undefined
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    if (value === undefined) return undefined
    const parsed = parseDecimal(value)
    if (!parsed) return undefined
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function nonNegative(value: string): string | undefined {
  const parsed = parseDecimal(value)
  if (!parsed) return undefined
  return decimalToString(
    parsed.coefficient < 0n ? { coefficient: 0n, scale: 0 } : parsed,
  )
}

function inputsOf(input: ImpactInput) {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].length > 0,
    ),
  )
}

function scoreFor(
  dollarValue: string | undefined,
  unitSignal: string | undefined,
  highImpactDollars: string,
  unitSignalScale: string,
): Pick<ImpactCategory, 'score' | 'scoreBasis' | 'value' | 'unitSignal'> {
  const parsedValue = dollarValue ? parseDecimal(dollarValue) : undefined
  const parsedCeiling = parseDecimal(highImpactDollars)
  if (parsedValue && parsedCeiling && parsedCeiling.coefficient > 0n) {
    const score = divide(
      multiply(parsedValue, { coefficient: 100n, scale: 0 }),
      parsedCeiling,
      0,
    )
    const capped = score.coefficient > 100n ? '100' : decimalToString(score)
    return {
      score: capped,
      scoreBasis: 'dollars',
      value: dollarValue ?? null,
      ...(unitSignal === undefined ? {} : { unitSignal }),
    }
  }

  const parsedSignal = unitSignal ? parseDecimal(unitSignal) : undefined
  const parsedScale = parseDecimal(unitSignalScale)
  if (parsedSignal && parsedScale && parsedScale.coefficient > 0n) {
    const score = divide(
      multiply(parsedSignal, { coefficient: 100n, scale: 0 }),
      parsedScale,
      0,
    )
    return {
      score: score.coefficient > 100n ? '100' : decimalToString(score),
      scoreBasis: 'units',
      value: null,
      ...(unitSignal === undefined ? {} : { unitSignal }),
    }
  }

  return { score: '0', scoreBasis: 'none', value: null }
}

function category(
  dollarValue: string | undefined,
  unitSignal: string | undefined,
  reason: string,
  input: ImpactInput,
  highImpactDollars: string,
  unitSignalScale: string,
): ImpactCategory {
  const scored = scoreFor(
    dollarValue,
    unitSignal,
    highImpactDollars,
    unitSignalScale,
  )
  if (scored.scoreBasis === 'none') {
    return {
      status: 'suppressed',
      ...scored,
      inputs: inputsOf(input),
      reason,
    }
  }
  return { status: 'calculated', ...scored, inputs: inputsOf(input) }
}

function validWeight(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback
}

function resolveConfig(options: ImpactOptions) {
  return {
    weights: {
      currentSpoilage: validWeight(
        options.weights?.currentSpoilage,
        IMPACT_DEFAULTS.weights.currentSpoilage,
      ),
      overordering: validWeight(
        options.weights?.overordering,
        IMPACT_DEFAULTS.weights.overordering,
      ),
      marginLoss: validWeight(
        options.weights?.marginLoss,
        IMPACT_DEFAULTS.weights.marginLoss,
      ),
      historicalSpoilage: validWeight(
        options.weights?.historicalSpoilage,
        IMPACT_DEFAULTS.weights.historicalSpoilage,
      ),
    },
    highImpactDollars:
      options.highImpactDollars ?? IMPACT_DEFAULTS.highImpactDollars,
    unitSignalScale: options.unitSignalScale ?? IMPACT_DEFAULTS.unitSignalScale,
  }
}

function finalizeImpact(
  categories: Record<ImpactCategoryKey, ImpactCategory>,
  input: ImpactInput,
  options: ImpactOptions,
): ImpactMetricResult {
  const config = resolveConfig(options)
  const active = Object.entries(categories).filter(
    (entry): entry is [ImpactCategoryKey, ImpactCategory] =>
      entry[1].status === 'calculated',
  )
  const weightTotal = active.reduce(
    (total, [key]) => total + config.weights[key],
    0,
  )
  const weightedScore = active.reduce(
    (total, [key, value]) =>
      total + BigInt(value.score) * BigInt(config.weights[key]),
    0n,
  )
  const value =
    weightTotal > 0
      ? decimalToString(
          divide(
            { coefficient: weightedScore, scale: 0 },
            { coefficient: BigInt(weightTotal), scale: 0 },
            0,
          ),
        )
      : null
  const dollarsAvailable = active.some(
    ([, categoryValue]) => categoryValue.scoreBasis === 'dollars',
  )

  if (value === null) {
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, no impact signals are available',
      inputs: inputsOf(input),
      units: { value: 'score', currency: input.currency ?? 'USD' },
      categories,
      dollarsAvailable,
      ...(dollarsAvailable
        ? {}
        : {
            dollarReason:
              'dollars cannot be calculated from the available data',
          }),
      weights: config.weights,
    }
  }

  return {
    status: 'calculated',
    value,
    inputs: {
      ...inputsOf(input),
      weightTotal: String(weightTotal),
      highImpactDollars: config.highImpactDollars,
      unitSignalScale: config.unitSignalScale,
    },
    units: { value: 'score', currency: input.currency ?? 'USD' },
    categories,
    dollarsAvailable,
    ...(dollarsAvailable
      ? {}
      : {
          dollarReason: 'dollars cannot be calculated from the available data',
        }),
    weights: config.weights,
  }
}

/**
 * Calculates impact as a weighted 0–100 severity score. Dollar values remain
 * exact and are retained by category; a category with no cost can use its
 * unit signal for ranking while explicitly reporting that dollars are not
 * available.
 */
export function calculateImpact(
  input: ImpactInput,
  options: ImpactOptions = {},
): ImpactMetricResult {
  const { highImpactDollars, unitSignalScale } = resolveConfig(options)

  const onHand = input.qtyOnHand ? parseDecimal(input.qtyOnHand) : undefined
  const historical = input.historicalSpoilageQty
    ? nonNegative(input.historicalSpoilageQty)
    : undefined
  const ordered = input.qtyOrdered ? parseDecimal(input.qtyOrdered) : undefined
  const sold = input.qtySold ? parseDecimal(input.qtySold) : undefined
  const unitCost = input.unitCost ? parseDecimal(input.unitCost) : undefined
  const revenue = input.revenue ? parseDecimal(input.revenue) : undefined
  const costOfSales = input.costOfSales
    ? parseDecimal(input.costOfSales)
    : unitCost && sold
      ? multiply(unitCost, sold)
      : undefined

  const currentValue =
    onHand && unitCost ? decimalToString(multiply(onHand, unitCost)) : undefined
  const historicalValue =
    historical && unitCost
      ? decimalToString(multiply(parseDecimal(historical) as Decimal, unitCost))
      : undefined
  const excess =
    ordered && sold
      ? nonNegative(decimalToString(subtract(ordered, sold)))
      : undefined
  const overorderingValue =
    excess && unitCost
      ? decimalToString(multiply(parseDecimal(excess) as Decimal, unitCost))
      : undefined
  const marginLoss =
    revenue && costOfSales
      ? nonNegative(decimalToString(subtract(costOfSales, revenue)))
      : undefined

  const categories = {
    currentSpoilage: category(
      currentValue,
      input.qtyOnHand,
      'current on-hand quantity is unavailable',
      input,
      highImpactDollars,
      unitSignalScale,
    ),
    historicalSpoilage: category(
      historicalValue,
      historical,
      'historical spoilage quantity is unavailable',
      input,
      highImpactDollars,
      unitSignalScale,
    ),
    overordering: category(
      overorderingValue,
      excess,
      'ordered and sold quantities are unavailable',
      input,
      highImpactDollars,
      unitSignalScale,
    ),
    marginLoss: category(
      marginLoss,
      marginLoss === undefined ? undefined : input.qtySold,
      'revenue and cost of sales are unavailable',
      input,
      highImpactDollars,
      unitSignalScale,
    ),
  } satisfies Record<ImpactCategoryKey, ImpactCategory>

  return finalizeImpact(categories, input, options)
}

export function rollupImpact(
  results: readonly ImpactMetricResult[],
  options: ImpactOptions = {},
): ImpactMetricResult {
  const config = resolveConfig(options)
  const categories = Object.fromEntries(
    (Object.keys(IMPACT_DEFAULTS.weights) as ImpactCategoryKey[]).map((key) => {
      const available = results
        .map((result) => result.categories[key])
        .filter((value) => value?.status === 'calculated')
      const dollarValues = available.map((value) => value.value)
      const unitSignals = available.map((value) => value.unitSignal)
      const allHaveDollars =
        available.length > 0 && dollarValues.every((value) => value !== null)
      const value = allHaveDollars ? sum(dollarValues as string[]) : undefined
      const unitSignal =
        unitSignals.some((signal) => signal !== undefined) &&
        unitSignals.every((signal) => signal !== undefined)
          ? sum(unitSignals as string[])
          : undefined
      const scored = scoreFor(
        value,
        unitSignal,
        config.highImpactDollars,
        config.unitSignalScale,
      )
      const result: ImpactCategory =
        scored.scoreBasis === 'none'
          ? {
              status: 'suppressed',
              ...scored,
              inputs: { itemCount: String(available.length) },
              reason: 'no complete category signals are available',
            }
          : {
              status: 'calculated',
              ...scored,
              inputs: { itemCount: String(available.length) },
            }
      return [key, result]
    }),
  ) as Record<ImpactCategoryKey, ImpactCategory>

  return finalizeImpact(categories, { currency: 'USD' }, options)
}
