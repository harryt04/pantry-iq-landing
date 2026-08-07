export interface RecommendationTransaction {
  date: string
  item: string
  qty: string | number
  revenue?: string | number | null
  cost?: string | number | null
}

export interface RecommendationPurchase {
  purchaseDate: string
  item: string
  qty: string | number
  unitCost?: string | number | null
}

export interface RecommendationInventorySnapshot {
  snapshotDate: string
  item: string
  qtyOnHand: string | number
}

export interface RecommendationItem {
  name: string
  shelfLifeDays?: number | null
  unitCost?: string | number | null
}

export interface Recommendation {
  item: string
  type: 'slow_sell_through' | 'waste_risk'
  observation: string
  financialImpact: number | null
  prediction: string | null
  suggestedAction: string
  impactScore: number
  urgencyScore: number
  confidenceScore: number
  rankScore: number
  evidence: {
    sources: string[]
    calculations: string[]
    assumptions: string[]
    historyWeeks: number
  }
}

export interface RecommendationResult {
  recommendations: Recommendation[]
  walletImpact: number
  historyWeeks: number
}

export interface RecommendationWeights {
  impact: number
  urgency: number
  confidence: number
}

const DEFAULT_WEIGHTS: RecommendationWeights = {
  impact: 0.4,
  urgency: 0.4,
  confidence: 0.2,
}

function numberValue(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function itemKey(item: string): string {
  return item.trim().toLowerCase()
}

function dateValue(value: string): number {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)))
}

function weightedAverageCost(
  purchases: RecommendationPurchase[],
  item: RecommendationItem | undefined,
): number {
  let quantity = 0
  let cost = 0

  for (const purchase of purchases) {
    const purchaseQuantity = numberValue(purchase.qty)
    const unitCost = numberValue(purchase.unitCost)
    if (purchaseQuantity > 0 && unitCost > 0) {
      quantity += purchaseQuantity
      cost += purchaseQuantity * unitCost
    }
  }

  if (quantity > 0) return cost / quantity
  return numberValue(item?.unitCost)
}

function historyWindow(
  transactions: RecommendationTransaction[],
  purchases: RecommendationPurchase[],
  inventory: RecommendationInventorySnapshot[],
): { earliest: number; latest: number; weeks: number } {
  const dates = [
    ...transactions.map((row) => dateValue(row.date)),
    ...purchases.map((row) => dateValue(row.purchaseDate)),
    ...inventory.map((row) => dateValue(row.snapshotDate)),
  ].filter((date) => date > 0)

  if (dates.length === 0) return { earliest: 0, latest: 0, weeks: 0 }

  const earliest = Math.min(...dates)
  const latest = Math.max(...dates)
  const days = Math.max(1, (latest - earliest) / 86_400_000 + 1)
  return { earliest, latest, weeks: days / 7 }
}

export function generateRecommendations({
  transactions,
  purchases,
  inventory,
  items = [],
  weights = DEFAULT_WEIGHTS,
  limit = 5,
}: {
  transactions: RecommendationTransaction[]
  purchases: RecommendationPurchase[]
  inventory: RecommendationInventorySnapshot[]
  items?: RecommendationItem[]
  weights?: RecommendationWeights
  limit?: number
}): RecommendationResult {
  const history = historyWindow(transactions, purchases, inventory)
  const groupedTransactions = new Map<string, RecommendationTransaction[]>()
  const groupedPurchases = new Map<string, RecommendationPurchase[]>()
  const latestInventory = new Map<string, RecommendationInventorySnapshot>()
  const itemDefinitions = new Map<string, RecommendationItem>()

  for (const item of items) itemDefinitions.set(itemKey(item.name), item)
  for (const row of transactions) {
    const key = itemKey(row.item)
    groupedTransactions.set(key, [...(groupedTransactions.get(key) || []), row])
  }
  for (const row of purchases) {
    const key = itemKey(row.item)
    groupedPurchases.set(key, [...(groupedPurchases.get(key) || []), row])
  }
  for (const row of inventory) {
    const key = itemKey(row.item)
    const current = latestInventory.get(key)
    if (
      !current ||
      dateValue(row.snapshotDate) >= dateValue(current.snapshotDate)
    ) {
      latestInventory.set(key, row)
    }
  }

  const keys = new Set([
    ...groupedTransactions.keys(),
    ...groupedPurchases.keys(),
    ...latestInventory.keys(),
  ])
  const recommendations: Recommendation[] = []

  for (const key of keys) {
    const itemTransactions = groupedTransactions.get(key) || []
    const itemPurchases = groupedPurchases.get(key) || []
    const itemDefinition = itemDefinitions.get(key)
    const sold = itemTransactions.reduce(
      (sum, row) => sum + numberValue(row.qty),
      0,
    )
    const ordered = itemPurchases.reduce(
      (sum, row) => sum + numberValue(row.qty),
      0,
    )
    const onHand = numberValue(latestInventory.get(key)?.qtyOnHand)
    const unitCost = weightedAverageCost(itemPurchases, itemDefinition)
    const sellThrough = ordered > 0 ? sold / ordered : 0
    const unexplainedUnits = Math.max(0, ordered - sold - onHand)
    const financialImpact =
      unitCost > 0
        ? onHand * unitCost + unexplainedUnits * unitCost * 0.5
        : null
    const issueDetected =
      (ordered > 0 && sellThrough < 0.5) || (onHand > 0 && sold === 0)

    if (!issueDetected) continue

    const shelfLifeDays = itemDefinition?.shelfLifeDays
    const urgencyBase = onHand > 0 && sold === 0 ? 75 : 55
    const urgencyScore = clampScore(
      shelfLifeDays == null
        ? urgencyBase
        : shelfLifeDays <= 3
          ? 100
          : shelfLifeDays <= 7
            ? 85
            : shelfLifeDays <= 14
              ? 65
              : urgencyBase,
    )
    const confidenceScore = clampScore(
      (history.weeks >= 8 ? 70 : history.weeks >= 4 ? 55 : 30) +
        (itemPurchases.length > 0 ? 15 : 0) +
        (latestInventory.has(key) ? 15 : 0),
    )
    const impactScore =
      financialImpact == null ? 0 : clampScore(financialImpact)
    const totalWeight = weights.impact + weights.urgency + weights.confidence
    const rankScore =
      totalWeight > 0
        ? (impactScore * weights.impact +
            urgencyScore * weights.urgency +
            confidenceScore * weights.confidence) /
          totalWeight
        : 0
    const displayName =
      itemTransactions[0]?.item ||
      itemPurchases[0]?.item ||
      itemDefinition?.name ||
      key
    const sellThroughText =
      ordered > 0
        ? `${(sellThrough * 100).toFixed(0)}% sell-through`
        : 'no purchase history'
    const observation = [
      `${displayName}: ${sellThroughText}`,
      ordered > 0 ? `${ordered.toFixed(1)} units ordered` : null,
      `${sold.toFixed(1)} units sold`,
      latestInventory.has(key) ? `${onHand.toFixed(1)} units on hand` : null,
    ]
      .filter(Boolean)
      .join('. ')
    const hasPrediction = history.weeks >= 4 && ordered > 0 && sellThrough < 0.5
    const prediction = hasPrediction
      ? `Prediction: Based on ${history.weeks.toFixed(1)} weeks of transaction history, ${displayName} may continue to move slowly if reordered.`
      : null
    const suggestedAction =
      onHand > 0 && sold === 0
        ? `Review ${displayName} before the next order and decide whether to use, return, or donate the on-hand stock.`
        : `Consider reducing the next ${displayName} order and review its menu demand.`

    recommendations.push({
      item: displayName,
      type: onHand > 0 && sold === 0 ? 'waste_risk' : 'slow_sell_through',
      observation,
      financialImpact,
      prediction,
      suggestedAction,
      impactScore,
      urgencyScore,
      confidenceScore,
      rankScore: Number(rankScore.toFixed(2)),
      evidence: {
        sources: [
          ...(itemTransactions.length > 0 ? ['transactions'] : []),
          ...(itemPurchases.length > 0 ? ['purchase orders'] : []),
          ...(latestInventory.has(key) ? ['inventory snapshot'] : []),
        ],
        calculations: [
          `sell-through = sold units / ordered units = ${(sellThrough * 100).toFixed(1)}%`,
          `unexplained units = max(ordered - sold - on hand, 0) = ${unexplainedUnits.toFixed(1)}`,
          financialImpact == null
            ? 'financial impact unavailable because no unit cost was provided'
            : `financial impact = on-hand risk + 50% of unexplained variance = $${financialImpact.toFixed(2)}`,
        ],
        assumptions: [
          'Unexplained variance is treated as a risk signal, not confirmed waste.',
          shelfLifeDays == null
            ? 'No item shelf life is configured; urgency uses a conservative default.'
            : `Configured shelf life is ${shelfLifeDays} days.`,
        ],
        historyWeeks: Number(history.weeks.toFixed(1)),
      },
    })
  }

  recommendations.sort((a, b) => b.rankScore - a.rankScore)
  return {
    recommendations: recommendations.slice(0, limit),
    walletImpact: Number(
      recommendations
        .reduce(
          (sum, recommendation) => sum + (recommendation.financialImpact || 0),
          0,
        )
        .toFixed(2),
    ),
    historyWeeks: Number(history.weeks.toFixed(1)),
  }
}
