import { METRICS_CONFIG } from '@/src/server/metrics/config'
import {
  buildEvidenceTrace,
  type EvidenceSourceInput,
} from '@/src/server/metrics/evidence'
import {
  rankRecommendations,
  type RankedRecommendation,
} from '@/src/server/metrics/ranking'
import type {
  MenuRecommendationType,
  RecommendationRecord,
} from '@/src/server/metrics/recommendations'

type Decimal = { coefficient: bigint; scale: number }
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

function parseDecimal(value: string): Decimal {
  if (!DECIMAL_PATTERN.test(value)) throw new Error(`Invalid decimal: ${value}`)
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsigned.split('.')
  return normalize({
    coefficient: BigInt(`${whole || '0'}${fraction}`) * (negative ? -1n : 1n),
    scale: fraction.length,
  })
}

function normalize(value: Decimal): Decimal {
  if (value.coefficient === 0n) return { coefficient: 0n, scale: 0 }
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function decimalString(value: Decimal) {
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

function multiply(left: Decimal, right: Decimal): Decimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
}

function divide(left: Decimal, right: Decimal, scale = 6): Decimal {
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

function compare(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale)
  const leftValue = left.coefficient * 10n ** BigInt(scale - left.scale)
  const rightValue = right.coefficient * 10n ** BigInt(scale - right.scale)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

function maxZero(value: Decimal) {
  return compare(value, { coefficient: 0n, scale: 0 }) > 0
    ? value
    : { coefficient: 0n, scale: 0 }
}

function scoreFromAmount(amount: string | null) {
  if (amount === null) return '0'
  const value = maxZero(parseDecimal(amount))
  const high = parseDecimal(METRICS_CONFIG.impact.thresholds.highImpactDollars)
  if (compare(value, high) >= 0) return '100'
  return decimalString(divide(multiply(value, parseDecimal('100')), high))
}

function scoreFromPercent(percent: string | null) {
  if (percent === null) return '0'
  const value = maxZero(parseDecimal(percent))
  return decimalString(
    compare(value, parseDecimal('100')) > 0 ? parseDecimal('100') : value,
  )
}

export type MenuMarginErosionInput = {
  itemId: string
  itemName: string
  unit: string
  marginPerItem: string
  marginThreshold: string
  unitsSold: string
}

export type MenuVarianceInput = {
  ingredientItemId: string
  ingredientName: string
  unit: string
  variance: string
  variancePercent: string | null
  ingredientCostPerUnit: string | null
}

export type IngredientCostIncreaseInput = {
  ingredientItemId: string
  ingredientName: string
  unit: string
  previousBatchCost: string
  currentBatchCost: string
  previousMenuPrice: string | null
  currentMenuPrice: string | null
  unitsSold: string
}

export type MenuRecommendationInput = {
  marginErosion?: readonly MenuMarginErosionInput[]
  recipeVariance?: readonly MenuVarianceInput[]
  ingredientCostIncrease?: readonly IngredientCostIncreaseInput[]
  sources?: readonly EvidenceSourceInput[]
}

type MenuMetric = {
  metricKey: string
  status: 'calculated'
  value: string
  result: {
    inputs: Record<string, string>
    units: Record<string, string>
    reason: string
  }
}

type MenuCandidate = {
  candidateId: string
  itemId: string
  itemName: string
  unit: string
  type: MenuRecommendationType
  detail: string
  value: string | null
  valueUnit: string
  impactAmount: string | null
  impactBasis: 'marginLoss' | 'none'
  dimensions: { impact: string; urgency: string; dataSufficiency: string }
  metrics: readonly MenuMetric[]
}

function candidateId(type: MenuRecommendationType, itemId: string) {
  return `menu:${type}:${itemId}`
}

function metric(
  type: MenuRecommendationType,
  value: string,
  inputs: Record<string, string>,
  units: Record<string, string>,
  detail: string,
): MenuMetric {
  return {
    metricKey: `menu.${type}`,
    status: 'calculated',
    value,
    result: {
      inputs,
      units,
      reason: `Recipe-derived figure. ${detail}`,
    },
  }
}

function marginCandidates(
  rows: readonly MenuMarginErosionInput[],
): MenuCandidate[] {
  return rows.flatMap((row) => {
    const erosion = maxZero(
      subtract(
        parseDecimal(row.marginThreshold),
        parseDecimal(row.marginPerItem),
      ),
    )
    if (erosion.coefficient === 0n) return []
    const amount = decimalString(multiply(erosion, parseDecimal(row.unitsSold)))
    return [
      {
        candidateId: candidateId('margin-erosion', row.itemId),
        itemId: row.itemId,
        itemName: row.itemName,
        unit: row.unit,
        type: 'margin-erosion' as const,
        detail: `Plate margin is $${row.marginPerItem}, below the recipe-derived menu average of $${row.marginThreshold}.`,
        value: row.marginPerItem,
        valueUnit: 'USD per plate',
        impactAmount: amount,
        impactBasis: 'marginLoss' as const,
        dimensions: {
          impact: scoreFromAmount(amount),
          urgency: '65',
          dataSufficiency: '100',
        },
        metrics: [
          metric(
            'margin-erosion',
            amount,
            {
              marginPerItem: row.marginPerItem,
              marginThreshold: row.marginThreshold,
              unitsSold: row.unitsSold,
            },
            {
              marginPerItem: 'USD per plate',
              marginThreshold: 'USD per plate',
              unitsSold: row.unit,
              result: 'USD',
            },
            'The gap is multiplied by recorded units sold; it is not a forecast.',
          ),
        ],
      },
    ]
  })
}

function varianceCandidates(
  rows: readonly MenuVarianceInput[],
): MenuCandidate[] {
  return rows.flatMap((row) => {
    const variance = maxZero(parseDecimal(row.variance))
    if (variance.coefficient === 0n || row.variancePercent === null) return []
    const amount = row.ingredientCostPerUnit
      ? decimalString(
          multiply(variance, parseDecimal(row.ingredientCostPerUnit)),
        )
      : null
    return [
      {
        candidateId: candidateId('recipe-variance', row.ingredientItemId),
        itemId: row.ingredientItemId,
        itemName: row.ingredientName,
        unit: row.unit,
        type: 'recipe-variance' as const,
        detail: `Actual usage is ${row.variance} ${row.unit} above recipe-derived usage (${row.variancePercent}%).`,
        value: row.variance,
        valueUnit: row.unit,
        impactAmount: amount,
        impactBasis:
          amount === null ? ('none' as const) : ('marginLoss' as const),
        dimensions: {
          impact:
            amount === null
              ? scoreFromPercent(row.variancePercent)
              : scoreFromAmount(amount),
          urgency: '55',
          dataSufficiency: '100',
        },
        metrics: [
          metric(
            'recipe-variance',
            amount ?? row.variancePercent,
            {
              variance: row.variance,
              variancePercent: row.variancePercent,
              ...(row.ingredientCostPerUnit
                ? { ingredientCostPerUnit: row.ingredientCostPerUnit }
                : {}),
            },
            {
              variance: row.unit,
              variancePercent: '%',
              result: amount === null ? row.unit : 'USD',
            },
            'Positive usage variance remains an observation; no cause is assigned.',
          ),
        ],
      },
    ]
  })
}

function costIncreaseCandidates(
  rows: readonly IngredientCostIncreaseInput[],
): MenuCandidate[] {
  return rows.flatMap((row) => {
    if (
      row.previousMenuPrice === null ||
      row.currentMenuPrice === null ||
      compare(
        parseDecimal(row.previousMenuPrice),
        parseDecimal(row.currentMenuPrice),
      ) !== 0
    )
      return []
    const increase = maxZero(
      subtract(
        parseDecimal(row.currentBatchCost),
        parseDecimal(row.previousBatchCost),
      ),
    )
    if (increase.coefficient === 0n) return []
    const amount = decimalString(
      multiply(increase, parseDecimal(row.unitsSold)),
    )
    return [
      {
        candidateId: candidateId(
          'ingredient-cost-increase',
          row.ingredientItemId,
        ),
        itemId: row.ingredientItemId,
        itemName: row.ingredientName,
        unit: row.unit,
        type: 'ingredient-cost-increase' as const,
        detail: `Recipe-derived batch cost rose from $${row.previousBatchCost} to $${row.currentBatchCost} while the menu price stayed at $${row.currentMenuPrice}.`,
        value: decimalString(increase),
        valueUnit: 'USD per batch',
        impactAmount: amount,
        impactBasis: 'marginLoss' as const,
        dimensions: {
          impact: scoreFromAmount(amount),
          urgency: '60',
          dataSufficiency: '100',
        },
        metrics: [
          metric(
            'ingredient-cost-increase',
            amount,
            {
              previousBatchCost: row.previousBatchCost,
              currentBatchCost: row.currentBatchCost,
              unitsSold: row.unitsSold,
            },
            {
              previousBatchCost: 'USD',
              currentBatchCost: 'USD',
              unitsSold: row.unit,
              result: 'USD',
            },
            'The recorded menu price did not change, so the cost movement is surfaced for review rather than treated as a pricing decision.',
          ),
        ],
      },
    ]
  })
}

export function buildMenuRecommendationCandidates(
  input: MenuRecommendationInput,
) {
  return [
    ...marginCandidates(input.marginErosion ?? []),
    ...varianceCandidates(input.recipeVariance ?? []),
    ...costIncreaseCandidates(input.ingredientCostIncrease ?? []),
  ]
}

export function rankMenuRecommendations(candidates: readonly MenuCandidate[]) {
  return rankRecommendations(
    candidates.map((candidate) => ({
      itemId: candidate.candidateId,
      dimensions: candidate.dimensions,
    })),
  )
}

export function assembleMenuRecommendationRecords(input: {
  candidates: readonly MenuCandidate[]
  ranked: readonly RankedRecommendation[]
  inputWindowStart: Date
  inputWindowEnd: Date
  sources?: readonly EvidenceSourceInput[]
}): RecommendationRecord[] {
  const candidates = new Map(
    input.candidates.map((candidate) => [candidate.candidateId, candidate]),
  )
  return input.ranked.flatMap((ranked) => {
    const candidate = candidates.get(ranked.itemId)
    if (!candidate) return []
    const inputWindowStart = input.inputWindowStart.toISOString()
    const inputWindowEnd = input.inputWindowEnd.toISOString()
    const evidenceTrace = buildEvidenceTrace({
      metrics: candidate.metrics,
      ranked,
      ...(input.sources ? { sources: input.sources } : {}),
      sourceCounts: { transactions: 0, purchaseOrders: 0, snapshots: 0 },
      sourceTimestamp: input.inputWindowEnd,
      config: METRICS_CONFIG,
      additionalAssumptions: [
        {
          name: 'recommendation.recipeDerived',
          value: 'true',
          origin: 'system-default',
          editPath: 'Recipes → recipe builder',
        },
      ],
    })
    return [
      {
        version: 1,
        itemId: candidate.itemId,
        itemName: candidate.itemName,
        rank: ranked.rank,
        score: ranked.score,
        observation: {
          purchaseOrderCount: 0,
          quantityOrdered: null,
          quantitySold: null,
          sellThroughRate: null,
          quantityOnHand: null,
          unit: candidate.unit,
          scores: {
            impact: ranked.dimensions.impact?.score ?? null,
            urgency: ranked.dimensions.urgency?.score ?? null,
            dataSufficiency: ranked.dimensions.dataSufficiency?.score ?? null,
          },
        },
        financialImpact: {
          amount: candidate.impactAmount,
          currency: 'USD' as const,
          basis: candidate.impactBasis,
          ...(candidate.impactAmount === null
            ? {
                explanation:
                  'A dollar impact cannot be calculated from the available recipe data.',
              }
            : {}),
        },
        suggestedAction: {
          framing: 'consider' as const,
          action: 'review-item' as const,
          timeHorizon: 'this week' as const,
        },
        recommendationType: candidate.type,
        recipeDerived: true as const,
        menuFinding: {
          label: 'Recipe-derived signal',
          detail: candidate.detail,
          value: candidate.value,
          unit: candidate.valueUnit,
        },
        dataFindings: [],
        evidenceTraceRef: {
          key: `${candidate.candidateId}:${inputWindowStart}:${inputWindowEnd}`,
          itemId: candidate.itemId,
          inputWindowStart,
          inputWindowEnd,
        },
        evidenceTrace,
      } satisfies RecommendationRecord,
    ]
  })
}
