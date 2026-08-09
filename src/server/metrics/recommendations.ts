import type { RankedRecommendation } from './ranking'

export const RECOMMENDATION_METRIC_KEY = 'recommendation' as const

type MetricResultShape = {
  metricKey: string
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  result: unknown
}

export type RecommendationItem = {
  itemId: string
  itemName: string
  unit: string
  purchaseOrderCount: number
  metrics: readonly MetricResultShape[]
}

export type RecommendationRecord = {
  version: 1
  itemId: string
  itemName: string
  rank: number
  score: string
  observation: {
    purchaseOrderCount: number
    quantityOrdered: string | null
    quantitySold: string | null
    sellThroughRate: string | null
    quantityOnHand: string | null
    unit: string
    scores: {
      impact: string | null
      urgency: string | null
      dataSufficiency: string | null
    }
  }
  financialImpact: {
    amount: string | null
    currency: 'USD'
    basis:
      | 'currentSpoilage'
      | 'historicalSpoilage'
      | 'overordering'
      | 'marginLoss'
      | 'none'
    explanation?: string
  }
  prediction?: {
    type: 'reorder'
    outcome: 'unlikely-to-sell' | 'sales-pattern-may-continue'
    basis: {
      source: 'transactions'
      historyWeeks: string
      minimumHistoryWeeks: string
    }
  }
  suggestedAction: {
    framing: 'consider'
    action: 'reduce-next-order-or-pull-from-menu' | 'review-item'
    timeHorizon: 'this week'
  }
  evidenceTraceRef: {
    key: string
    itemId: string
    inputWindowStart: string
    inputWindowEnd: string
  }
}

type ObjectRecord = Record<string, unknown>

function isRecord(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metricValue(metrics: readonly MetricResultShape[], metricKey: string) {
  const metric = metrics.find((candidate) => candidate.metricKey === metricKey)
  return metric?.status === 'calculated' ? metric.value : null
}

function metricResult(
  metrics: readonly MetricResultShape[],
  metricKey: string,
): ObjectRecord | undefined {
  const metric = metrics.find((candidate) => candidate.metricKey === metricKey)
  return metric && isRecord(metric.result) ? metric.result : undefined
}

function recordValue(record: ObjectRecord | undefined, key: string) {
  return record?.[key]
}

function metricInput(
  metrics: readonly MetricResultShape[],
  metricKey: string,
  inputKey: string,
) {
  const result = metricResult(metrics, metricKey)
  const inputs = result && isRecord(result.inputs) ? result.inputs : undefined
  const value = inputs?.[inputKey]
  return typeof value === 'string' ? value : null
}

function dollarImpact(
  metrics: readonly MetricResultShape[],
): RecommendationRecord['financialImpact'] {
  const result = metricResult(metrics, 'impact')
  const categories =
    result && isRecord(result.categories) ? result.categories : {}
  const keys = [
    'currentSpoilage',
    'historicalSpoilage',
    'overordering',
    'marginLoss',
  ] as const

  for (const key of keys) {
    const category = categories[key]
    if (!isRecord(category)) continue
    if (
      category.status === 'calculated' &&
      category.scoreBasis === 'dollars' &&
      typeof category.value === 'string'
    ) {
      return {
        amount: category.value,
        currency: 'USD',
        basis: key,
      }
    }
  }

  const dollarReason = result?.dollarReason
  const reason =
    typeof dollarReason === 'string'
      ? dollarReason
      : typeof result?.reason === 'string'
        ? result.reason
        : 'dollars cannot be calculated from the available data'
  return {
    amount: null,
    currency: 'USD',
    basis: 'none',
    explanation: reason,
  }
}

function predictionFor(
  metrics: readonly MetricResultShape[],
): RecommendationRecord['prediction'] {
  const result = metricResult(metrics, 'dataSufficiency')
  if (result?.predictionEligible !== true) return undefined

  const inputs = result && isRecord(result.inputs) ? result.inputs : undefined
  const historyWeeks =
    typeof recordValue(inputs, 'historyWeeks') === 'string'
      ? (recordValue(inputs, 'historyWeeks') as string)
      : '0'
  const minimumHistoryWeeks =
    typeof recordValue(inputs, 'predictionHistoryWeeks') === 'string'
      ? (recordValue(inputs, 'predictionHistoryWeeks') as string)
      : '4'
  const quantitySold = metricInput(metrics, 'sellThrough', 'qtySold')

  return {
    type: 'reorder',
    outcome:
      quantitySold === '0' ? 'unlikely-to-sell' : 'sales-pattern-may-continue',
    basis: {
      source: 'transactions',
      historyWeeks,
      minimumHistoryWeeks,
    },
  }
}

function actionFor(
  item: RecommendationItem,
): RecommendationRecord['suggestedAction'] {
  const ordered = metricInput(item.metrics, 'sellThrough', 'qtyOrdered')
  const sold = metricInput(item.metrics, 'sellThrough', 'qtySold')

  return {
    framing: 'consider',
    action:
      ordered !== null && sold !== null && sold === '0'
        ? 'reduce-next-order-or-pull-from-menu'
        : ordered !== null
          ? 'review-item'
          : 'review-item',
    timeHorizon: 'this week',
  }
}

export function assembleRecommendationRecords(input: {
  items: readonly RecommendationItem[]
  rankedItems: readonly RankedRecommendation[]
  inputWindowStart: Date
  inputWindowEnd: Date
}): RecommendationRecord[] {
  const itemById = new Map(input.items.map((item) => [item.itemId, item]))
  const inputWindowStart = input.inputWindowStart.toISOString()
  const inputWindowEnd = input.inputWindowEnd.toISOString()

  return input.rankedItems.flatMap((ranked) => {
    const item = itemById.get(ranked.itemId)
    if (!item) return []

    const sellThroughRate = metricValue(item.metrics, 'sellThrough')
    const quantityOrdered = metricInput(
      item.metrics,
      'sellThrough',
      'qtyOrdered',
    )
    const quantitySold = metricInput(item.metrics, 'sellThrough', 'qtySold')
    const quantityOnHand = metricInput(
      item.metrics,
      'spoilageRisk',
      'qtyOnHand',
    )

    const prediction = predictionFor(item.metrics)

    return [
      {
        version: 1,
        itemId: item.itemId,
        itemName: item.itemName,
        rank: ranked.rank,
        score: ranked.score,
        observation: {
          purchaseOrderCount: item.purchaseOrderCount,
          quantityOrdered,
          quantitySold,
          sellThroughRate,
          quantityOnHand,
          unit: item.unit,
          scores: {
            impact: ranked.dimensions.impact?.score ?? null,
            urgency: ranked.dimensions.urgency?.score ?? null,
            dataSufficiency: ranked.dimensions.dataSufficiency?.score ?? null,
          },
        },
        financialImpact: dollarImpact(item.metrics),
        ...(prediction ? { prediction } : {}),
        suggestedAction: actionFor(item),
        evidenceTraceRef: {
          key: `recommendation:${item.itemId}:${inputWindowStart}:${inputWindowEnd}`,
          itemId: item.itemId,
          inputWindowStart,
          inputWindowEnd,
        },
      } satisfies RecommendationRecord,
    ]
  })
}
