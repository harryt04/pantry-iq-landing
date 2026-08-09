/**
 * The one runtime configuration source for the deterministic recommendation
 * engine. Defaults are intentionally plain data so an operator can override
 * them with PANTRYIQ_METRICS_CONFIG without changing calculation code.
 */

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

export const DEFAULT_METRICS_CONFIG = {
  impact: {
    weights: {
      currentSpoilage: 40,
      overordering: 25,
      marginLoss: 20,
      historicalSpoilage: 15,
    },
    thresholds: {
      highImpactDollars: '100',
      mediumImpactDollars: '25',
      lowImpactDollars: '0',
    },
    unitSignalScale: '10',
  },
  urgency: {
    weights: {
      shelfLife: 50,
      trendAcceleration: 30,
      supplierLeadTime: 20,
    },
    highUrgencyDays: 7,
    mediumUrgencyDays: 14,
    lowUrgencyDays: 0,
    minimumTrendHistoryWeeks: 2,
    trendWindowDays: 7,
  },
  sufficiency: {
    dashboardHistoryDays: 7,
    predictionHistoryWeeks: 4,
    weights: {
      history: 45,
      purchaseCompleteness: 25,
      inventoryPresence: 15,
      patternConsistency: 15,
    },
  },
  spoilage: {
    fallbackWindowDays: 7,
    varianceThresholdPercent: '20',
  },
  ranking: {
    weights: {
      impact: '0.40',
      urgency: '0.40',
      dataSufficiency: '0.20',
    },
    lowImpact: '0',
    limit: 5,
  },
} as const

export type MetricsConfig = {
  impact: {
    weights: Record<keyof typeof DEFAULT_METRICS_CONFIG.impact.weights, number>
    thresholds: {
      highImpactDollars: string
      mediumImpactDollars: string
      lowImpactDollars: string
    }
    unitSignalScale: string
  }
  urgency: {
    weights: Record<keyof typeof DEFAULT_METRICS_CONFIG.urgency.weights, number>
    highUrgencyDays: number
    mediumUrgencyDays: number
    lowUrgencyDays: number
    minimumTrendHistoryWeeks: number
    trendWindowDays: number
  }
  sufficiency: {
    dashboardHistoryDays: number
    predictionHistoryWeeks: number
    weights: Record<
      keyof typeof DEFAULT_METRICS_CONFIG.sufficiency.weights,
      number
    >
  }
  spoilage: {
    fallbackWindowDays: number
    varianceThresholdPercent: string
  }
  ranking: {
    weights: Record<keyof typeof DEFAULT_METRICS_CONFIG.ranking.weights, string>
    lowImpact: string
    limit: number
  }
}

type Decimal = { coefficient: bigint; scale: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDecimal(value: string, label: string): Decimal {
  if (!DECIMAL_PATTERN.test(value))
    throw new Error(`Metrics configuration ${label} must be a decimal string.`)

  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  return {
    coefficient:
      BigInt(`${integer}${fraction}`.replace(/^0+(?=\d)/, '') || '0') *
      (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function compare(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale)
  const leftValue = left.coefficient * 10n ** BigInt(scale - left.scale)
  const rightValue = right.coefficient * 10n ** BigInt(scale - right.scale)
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1
}

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return {
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  }
}

function validateNonNegativeDecimal(value: unknown, label: string) {
  if (typeof value !== 'string')
    throw new Error(`Metrics configuration ${label} must be a decimal string.`)
  const parsed = parseDecimal(value, label)
  if (parsed.coefficient < 0n)
    throw new Error(`Metrics configuration ${label} cannot be negative.`)
  return value
}

function validateInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(
      `Metrics configuration ${label} must be a non-negative safe integer.`,
    )
  return value as number
}

function validateIntegerWeights<const T extends readonly string[]>(
  weights: Record<string, unknown>,
  labels: T,
  expectedTotal: number,
): Record<T[number], number> {
  let total = 0
  const validated = {} as Record<T[number], number>
  for (const label of labels) {
    const value = validateInteger(weights[label], `weights.${label}`)
    total += value
    validated[label as T[number]] = value
  }
  if (total !== expectedTotal)
    throw new Error(
      `Metrics configuration weights must sum to ${expectedTotal}; received ${total}.`,
    )
  return validated
}

function validateDecimalWeights<const T extends readonly string[]>(
  weights: Record<string, unknown>,
  labels: T,
): Record<T[number], string> {
  let total: Decimal = { coefficient: 0n, scale: 0 }
  const validated = {} as Record<T[number], string>
  for (const label of labels) {
    const value = weights[label]
    if (typeof value !== 'string')
      throw new Error(
        `Metrics configuration weights.${label} must be a decimal string.`,
      )
    const parsed = parseDecimal(value, `weights.${label}`)
    if (parsed.coefficient < 0n)
      throw new Error(
        `Metrics configuration weights.${label} cannot be negative.`,
      )
    total = add(total, parsed)
    validated[label as T[number]] = value
  }
  if (compare(total, { coefficient: 1n, scale: 0 }) !== 0)
    throw new Error(
      'Metrics configuration ranking weights must sum to 1; change the weights so the normalized formula remains valid.',
    )
  return validated
}

function mergeConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  path = '',
): Record<string, unknown> {
  for (const [key, value] of Object.entries(override)) {
    const label = path ? `${path}.${key}` : key
    if (!(key in base))
      throw new Error(`Metrics configuration has unknown key ${label}.`)
    const current = base[key]
    if (isRecord(current)) {
      if (!isRecord(value))
        throw new Error(`Metrics configuration ${label} must be an object.`)
      base[key] = mergeConfig({ ...current }, value, label)
    } else {
      base[key] = value
    }
  }
  return base
}

function validateConfig(config: Record<string, unknown>): MetricsConfig {
  const impact = config.impact
  const urgency = config.urgency
  const sufficiency = config.sufficiency
  const spoilage = config.spoilage
  const ranking = config.ranking
  if (
    !isRecord(impact) ||
    !isRecord(urgency) ||
    !isRecord(sufficiency) ||
    !isRecord(spoilage) ||
    !isRecord(ranking)
  )
    throw new Error('Metrics configuration sections must be objects.')

  const impactWeights = impact.weights
  const urgencyWeights = urgency.weights
  const sufficiencyWeights = sufficiency.weights
  const rankingWeights = ranking.weights
  if (
    !isRecord(impactWeights) ||
    !isRecord(urgencyWeights) ||
    !isRecord(sufficiencyWeights) ||
    !isRecord(rankingWeights)
  )
    throw new Error('Metrics configuration weight groups must be objects.')

  const validatedImpactWeights = validateIntegerWeights(
    impactWeights,
    ['currentSpoilage', 'overordering', 'marginLoss', 'historicalSpoilage'],
    100,
  )
  const validatedUrgencyWeights = validateIntegerWeights(
    urgencyWeights,
    ['shelfLife', 'trendAcceleration', 'supplierLeadTime'],
    100,
  )
  const validatedSufficiencyWeights = validateIntegerWeights(
    sufficiencyWeights,
    [
      'history',
      'purchaseCompleteness',
      'inventoryPresence',
      'patternConsistency',
    ],
    100,
  )
  const validatedRankingWeights = validateDecimalWeights(rankingWeights, [
    'impact',
    'urgency',
    'dataSufficiency',
  ])

  const highImpact = validateNonNegativeDecimal(
    (impact.thresholds as Record<string, unknown>)?.highImpactDollars,
    'impact.thresholds.highImpactDollars',
  )
  const mediumImpact = validateNonNegativeDecimal(
    (impact.thresholds as Record<string, unknown>)?.mediumImpactDollars,
    'impact.thresholds.mediumImpactDollars',
  )
  const lowImpactDollars = validateNonNegativeDecimal(
    (impact.thresholds as Record<string, unknown>)?.lowImpactDollars,
    'impact.thresholds.lowImpactDollars',
  )
  if (
    compare(
      parseDecimal(highImpact, 'highImpactDollars'),
      parseDecimal(mediumImpact, 'mediumImpactDollars'),
    ) < 0 ||
    compare(
      parseDecimal(mediumImpact, 'mediumImpactDollars'),
      parseDecimal(lowImpactDollars, 'lowImpactDollars'),
    ) < 0
  )
    throw new Error(
      'Metrics configuration impact thresholds must descend from high to low.',
    )

  const highUrgencyDays = validateInteger(
    urgency.highUrgencyDays,
    'urgency.highUrgencyDays',
  )
  const mediumUrgencyDays = validateInteger(
    urgency.mediumUrgencyDays,
    'urgency.mediumUrgencyDays',
  )
  const lowUrgencyDays = validateInteger(
    urgency.lowUrgencyDays,
    'urgency.lowUrgencyDays',
  )
  if (!(
    lowUrgencyDays <= highUrgencyDays && highUrgencyDays <= mediumUrgencyDays
  ))
    throw new Error(
      'Metrics configuration urgency thresholds must ascend from low to high days.',
    )

  const result = {
    impact: {
      weights: validatedImpactWeights,
      thresholds: {
        highImpactDollars: highImpact,
        mediumImpactDollars: mediumImpact,
        lowImpactDollars,
      },
      unitSignalScale: validateNonNegativeDecimal(
        impact.unitSignalScale,
        'impact.unitSignalScale',
      ),
    },
    urgency: {
      weights: validatedUrgencyWeights,
      highUrgencyDays,
      mediumUrgencyDays,
      lowUrgencyDays,
      minimumTrendHistoryWeeks: Math.max(
        1,
        validateInteger(
          urgency.minimumTrendHistoryWeeks,
          'urgency.minimumTrendHistoryWeeks',
        ),
      ),
      trendWindowDays: Math.max(
        1,
        validateInteger(urgency.trendWindowDays, 'urgency.trendWindowDays'),
      ),
    },
    sufficiency: {
      dashboardHistoryDays: Math.max(
        1,
        validateInteger(
          sufficiency.dashboardHistoryDays,
          'sufficiency.dashboardHistoryDays',
        ),
      ),
      predictionHistoryWeeks: Math.max(
        1,
        validateInteger(
          sufficiency.predictionHistoryWeeks,
          'sufficiency.predictionHistoryWeeks',
        ),
      ),
      weights: validatedSufficiencyWeights,
    },
    spoilage: {
      fallbackWindowDays: Math.max(
        1,
        validateInteger(
          spoilage.fallbackWindowDays,
          'spoilage.fallbackWindowDays',
        ),
      ),
      varianceThresholdPercent: validateNonNegativeDecimal(
        spoilage.varianceThresholdPercent,
        'spoilage.varianceThresholdPercent',
      ),
    },
    ranking: {
      weights: validatedRankingWeights,
      lowImpact: validateNonNegativeDecimal(
        ranking.lowImpact,
        'ranking.lowImpact',
      ),
      limit: Math.max(1, validateInteger(ranking.limit, 'ranking.limit')),
    },
  } satisfies MetricsConfig

  return result
}

export function parseMetricsConfig(raw: unknown): MetricsConfig {
  if (!isRecord(raw))
    throw new Error('Metrics configuration must be a JSON object.')
  return validateConfig(
    mergeConfig(
      JSON.parse(JSON.stringify(DEFAULT_METRICS_CONFIG)) as Record<
        string,
        unknown
      >,
      raw,
    ),
  )
}

function loadMetricsConfig() {
  const raw = process.env.PANTRYIQ_METRICS_CONFIG
  if (!raw) return parseMetricsConfig({})
  try {
    return parseMetricsConfig(JSON.parse(raw))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Invalid PANTRYIQ_METRICS_CONFIG: ${message}`)
  }
}

export const METRICS_CONFIG = loadMetricsConfig()
