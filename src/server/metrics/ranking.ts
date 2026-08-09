/**
 * Ranks operational signals without routing scores or weights through
 * floating-point arithmetic. Scores are 0–100 values; weights are decimal
 * strings so a future dimension can be added without changing this formula.
 */

import { METRICS_CONFIG } from './config'

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

export const RANKING_DEFAULTS = METRICS_CONFIG.ranking

export type RankingCandidate = {
  itemId: string
  dimensions: Record<string, string>
}

export type RankingOptions = {
  weights?: Record<string, string>
  lowImpact?: string
  limit?: number
}

export type RankedRecommendation = {
  itemId: string
  rank: number
  score: string
  dimensions: Record<string, { score: string; weight: string }>
}

export type PrecomputedRankingItem = {
  itemId: string
  metrics: readonly {
    metricKey: string
    status: 'calculated' | 'cannot-calculate'
    value: string | null
  }[]
}

type Decimal = { coefficient: bigint; scale: number }

function parseDecimal(value: string, label: string): Decimal {
  if (!DECIMAL_PATTERN.test(value))
    throw new Error(`Ranking ${label} must be a decimal string.`)

  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  return normalize({
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  })
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

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return normalize({
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  })
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
}

function compare(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale)
  const leftValue = left.coefficient * 10n ** BigInt(scale - left.scale)
  const rightValue = right.coefficient * 10n ** BigInt(scale - right.scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function compareRatio(
  left: { numerator: Decimal; denominator: Decimal },
  right: { numerator: Decimal; denominator: Decimal },
) {
  return compare(
    multiply(left.numerator, right.denominator),
    multiply(right.numerator, left.denominator),
  )
}

function divide(left: Decimal, right: Decimal, scale: number): Decimal {
  if (right.coefficient === 0n) throw new Error('Ranking weight total is zero.')

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

function decimalToString(decimal: Decimal) {
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

function validateScore(score: Decimal, dimension: string) {
  if (compare(score, { coefficient: 0n, scale: 0 }) < 0)
    throw new Error(`Ranking ${dimension} score must be between 0 and 100.`)
  if (compare(score, { coefficient: 100n, scale: 0 }) > 0)
    throw new Error(`Ranking ${dimension} score must be between 0 and 100.`)
}

function validateWeight(weight: Decimal, dimension: string) {
  if (compare(weight, { coefficient: 0n, scale: 0 }) < 0)
    throw new Error(`Ranking ${dimension} weight cannot be negative.`)
}

function resolveConfig(options: RankingOptions) {
  const weights: Record<string, string> = {
    ...RANKING_DEFAULTS.weights,
    ...options.weights,
  }
  const limit = options.limit ?? RANKING_DEFAULTS.limit
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('Ranking limit must be a positive safe integer.')

  return {
    weights,
    lowImpact: parseDecimal(
      options.lowImpact ?? RANKING_DEFAULTS.lowImpact,
      'low-impact floor',
    ),
    limit,
  }
}

/**
 * Ranks candidates by the normalized weighted mean. The comparison keeps the
 * unrounded fraction, so two scores that happen to display equally still use
 * the deterministic tie-break rule correctly.
 */
export function rankRecommendations(
  candidates: readonly RankingCandidate[],
  options: RankingOptions = {},
): RankedRecommendation[] {
  const config = resolveConfig(options)
  const evaluated = candidates.map((candidate) => {
    const dimensionEntries = Object.entries(candidate.dimensions)
    if (dimensionEntries.length === 0)
      throw new Error(
        `Ranking candidate ${candidate.itemId} has no dimensions.`,
      )

    let numerator: Decimal = { coefficient: 0n, scale: 0 }
    let denominator: Decimal = { coefficient: 0n, scale: 0 }
    const dimensions: RankedRecommendation['dimensions'] = {}

    for (const [dimension, rawScore] of dimensionEntries) {
      const rawWeight = config.weights[dimension]
      if (rawWeight === undefined)
        throw new Error(`Ranking weight is missing for ${dimension}.`)

      const score = parseDecimal(rawScore, `${dimension} score`)
      const weight = parseDecimal(rawWeight, `${dimension} weight`)
      validateScore(score, dimension)
      validateWeight(weight, dimension)
      numerator = add(numerator, multiply(score, weight))
      denominator = add(denominator, weight)
      dimensions[dimension] = {
        score: decimalToString(score),
        weight: decimalToString(weight),
      }
    }

    if (compare(denominator, { coefficient: 0n, scale: 0 }) === 0)
      throw new Error('Ranking weights must have a positive total.')

    const impact = parseDecimal(
      candidate.dimensions.impact ?? '0',
      'impact score',
    )
    validateScore(impact, 'impact')
    if (compare(impact, config.lowImpact) < 0) return undefined

    return {
      candidate,
      dimensions,
      impact,
      ratio: { numerator, denominator },
      score: decimalToString(divide(numerator, denominator, 2)),
    }
  })

  return evaluated
    .filter((item): item is NonNullable<typeof item> => item !== undefined)
    .sort((left, right) => {
      const scoreOrder = compareRatio(right.ratio, left.ratio)
      if (scoreOrder !== 0) return scoreOrder

      const impactOrder = compare(right.impact, left.impact)
      if (impactOrder !== 0) return impactOrder
      return left.candidate.itemId.localeCompare(right.candidate.itemId)
    })
    .slice(0, config.limit)
    .map((item, index) => ({
      itemId: item.candidate.itemId,
      rank: index + 1,
      score: item.score,
      dimensions: item.dimensions,
    }))
}

/** Selects the dashboard candidates from one successful precompute result. */
export function rankPrecomputedItems(
  items: readonly PrecomputedRankingItem[],
  options: RankingOptions = {},
) {
  const candidates = items.flatMap((item) => {
    const metrics = new Map(
      item.metrics.map((metric) => [metric.metricKey, metric]),
    )
    const dimensions = Object.fromEntries(
      ['impact', 'urgency', 'dataSufficiency'].flatMap((key) => {
        const metric = metrics.get(key)
        return metric?.status === 'calculated' && metric.value !== null
          ? [[key, metric.value]]
          : []
      }),
    )

    return Object.keys(dimensions).length === 3
      ? [{ itemId: item.itemId, dimensions }]
      : []
  })

  return rankRecommendations(candidates, options)
}
