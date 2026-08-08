import type { MetricResult } from './definitions'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export const DATA_SUFFICIENCY_METRIC = 'dataSufficiency' as const

export const DATA_SUFFICIENCY_DEFAULTS = {
  dashboardHistoryDays: 7,
  predictionHistoryWeeks: 4,
  weights: {
    history: 45,
    purchaseCompleteness: 25,
    inventoryPresence: 15,
    patternConsistency: 15,
  },
} as const

export type SufficiencyInput = {
  transactions: readonly { transactedAt: Date }[]
  purchaseOrders: readonly { orderedAt: Date }[]
  inventorySnapshots: readonly { countedAt: Date }[]
}

export type SufficiencyOptions = {
  dashboardHistoryDays?: number
  predictionHistoryWeeks?: number
  weights?: Partial<{
    history: number
    purchaseCompleteness: number
    inventoryPresence: number
    patternConsistency: number
  }>
}

export type RecommendationType =
  | 'observedSellThrough'
  | 'spoilageEstimate'
  | 'marginAnalysis'
  | 'trendAnalysis'
  | 'predictiveReorder'

export type RecommendationReadiness = {
  eligible: boolean
  reason: string
}

export type DataSufficiencyResult = Extract<
  MetricResult<string>,
  { status: 'calculated' }
> & {
  components: {
    history: string
    purchaseCompleteness: string
    inventoryPresence: string
    patternConsistency: string
  }
  recommendationReadiness: Record<RecommendationType, RecommendationReadiness>
  dashboardEligible: boolean
  predictionEligible: boolean
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return '0'
  const scaledNumerator = BigInt(Math.max(0, numerator)) * 100n
  const divisor = BigInt(denominator)
  let quotient = scaledNumerator / divisor
  if ((scaledNumerator % divisor) * 2n >= divisor) quotient += 1n
  return quotient > 100n ? '100' : quotient.toString()
}

function weightedScore(
  components: DataSufficiencyResult['components'],
  weights: Required<NonNullable<SufficiencyOptions['weights']>>,
) {
  const weightedTotal =
    BigInt(components.history) * BigInt(weights.history) +
    BigInt(components.purchaseCompleteness) *
      BigInt(weights.purchaseCompleteness) +
    BigInt(components.inventoryPresence) * BigInt(weights.inventoryPresence) +
    BigInt(components.patternConsistency) * BigInt(weights.patternConsistency)
  const weightTotal =
    weights.history +
    weights.purchaseCompleteness +
    weights.inventoryPresence +
    weights.patternConsistency
  if (weightTotal <= 0) return '0'

  const divisor = BigInt(weightTotal)
  let score = weightedTotal / divisor
  if ((weightedTotal % divisor) * 2n >= divisor) score += 1n
  return score > 100n ? '100' : score.toString()
}

function validDates(dates: readonly Date[]) {
  return dates
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())
}

function weekBuckets(dates: readonly Date[], start: Date, end: Date) {
  const startMs = start.getTime()
  const endMs = end.getTime()
  return new Set(
    dates
      .filter((date) => {
        const timestamp = date.getTime()
        return timestamp >= startMs && timestamp <= endMs
      })
      .map((date) => Math.floor((date.getTime() - startMs) / WEEK_MS)),
  )
}

function readiness(
  input: SufficiencyInput,
  historyWeeks: number,
  predictionHistoryWeeks: number,
): Record<RecommendationType, RecommendationReadiness> {
  const hasTransactions = input.transactions.length > 0
  const hasPurchases = input.purchaseOrders.length > 0
  const hasInventory = input.inventorySnapshots.length > 0

  return {
    observedSellThrough: {
      eligible: hasTransactions,
      reason: hasTransactions
        ? 'transaction history is available'
        : 'requires at least one transaction',
    },
    spoilageEstimate: {
      eligible: hasTransactions && hasPurchases && hasInventory,
      reason:
        hasTransactions && hasPurchases && hasInventory
          ? 'transactions, purchase orders, and inventory counts are available'
          : 'requires transactions, purchase orders, and inventory counts',
    },
    marginAnalysis: {
      eligible: hasTransactions && hasPurchases,
      reason:
        hasTransactions && hasPurchases
          ? 'transactions and purchase orders are available'
          : 'requires transactions and purchase orders',
    },
    trendAnalysis: {
      eligible: historyWeeks >= 2,
      reason:
        historyWeeks >= 2
          ? 'at least two weeks of transaction history are available'
          : 'requires at least two weeks of transaction history',
    },
    predictiveReorder: {
      eligible: historyWeeks >= predictionHistoryWeeks,
      reason:
        historyWeeks >= predictionHistoryWeeks
          ? `at least ${predictionHistoryWeeks} weeks of transaction history are available`
          : `requires ${predictionHistoryWeeks} weeks of transaction history`,
    },
  }
}

/**
 * Scores data coverage, not the certainty of an operational conclusion.
 * Weekly coverage is used as the deterministic pattern-consistency proxy
 * until the ranking engine has a richer seasonal pattern model.
 */
export function calculateDataSufficiency(
  input: SufficiencyInput,
  options: SufficiencyOptions = {},
): DataSufficiencyResult {
  const transactions = validDates(
    input.transactions.map(({ transactedAt }) => transactedAt),
  )
  const purchases = validDates(
    input.purchaseOrders.map(({ orderedAt }) => orderedAt),
  )
  const snapshots = validDates(
    input.inventorySnapshots.map(({ countedAt }) => countedAt),
  )
  const firstTransaction = transactions[0]
  const lastTransaction = transactions.at(-1)
  const historyDays =
    firstTransaction && lastTransaction
      ? Math.floor(
          (lastTransaction.getTime() - firstTransaction.getTime()) / DAY_MS,
        )
      : 0
  const historyWeeks = Math.floor(historyDays / 7)
  const expectedWeeks = transactions.length > 0 ? historyWeeks + 1 : 0
  const transactionWeeks =
    firstTransaction && lastTransaction
      ? weekBuckets(transactions, firstTransaction, lastTransaction)
      : new Set<number>()
  const purchaseWeeks =
    firstTransaction && lastTransaction
      ? weekBuckets(purchases, firstTransaction, lastTransaction)
      : new Set<number>()
  const inventoryWeeks =
    firstTransaction && lastTransaction
      ? weekBuckets(snapshots, firstTransaction, lastTransaction)
      : new Set<number>()

  const predictionHistoryWeeks = Math.max(
    1,
    options.predictionHistoryWeeks ??
      DATA_SUFFICIENCY_DEFAULTS.predictionHistoryWeeks,
  )
  const dashboardHistoryDays = Math.max(
    1,
    options.dashboardHistoryDays ??
      DATA_SUFFICIENCY_DEFAULTS.dashboardHistoryDays,
  )
  const weights = {
    ...DATA_SUFFICIENCY_DEFAULTS.weights,
    ...options.weights,
  }
  const components = {
    history: percentage(
      Math.min(historyDays, predictionHistoryWeeks * 7),
      predictionHistoryWeeks * 7,
    ),
    purchaseCompleteness: percentage(purchaseWeeks.size, transactionWeeks.size),
    inventoryPresence: percentage(inventoryWeeks.size, transactionWeeks.size),
    patternConsistency: percentage(transactionWeeks.size, expectedWeeks),
  }
  const recommendationReadiness = readiness(
    input,
    historyWeeks,
    predictionHistoryWeeks,
  )

  return {
    status: 'calculated',
    value: weightedScore(components, weights),
    inputs: {
      historyDays: String(historyDays),
      historyWeeks: String(historyWeeks),
      transactionCount: String(transactions.length),
      transactionWeeks: String(transactionWeeks.size),
      purchaseCount: String(purchases.length),
      purchaseWeeks: String(purchaseWeeks.size),
      inventorySnapshotCount: String(snapshots.length),
      inventoryWeeks: String(inventoryWeeks.size),
      dashboardHistoryDays: String(dashboardHistoryDays),
      predictionHistoryWeeks: String(predictionHistoryWeeks),
    },
    units: {
      value: 'score',
      historyDays: 'days',
      historyWeeks: 'weeks',
      transactionCount: 'rows',
      transactionWeeks: 'weeks',
      purchaseCount: 'rows',
      purchaseWeeks: 'weeks',
      inventorySnapshotCount: 'rows',
      inventoryWeeks: 'weeks',
    },
    components,
    recommendationReadiness,
    dashboardEligible: historyDays >= dashboardHistoryDays,
    predictionEligible: historyWeeks >= predictionHistoryWeeks,
  }
}
