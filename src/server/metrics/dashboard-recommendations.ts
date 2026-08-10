import { and, asc, eq, or } from 'drizzle-orm'

import { getLatestSuccessfulMetricRun } from './precompute'
import type { RecommendationRecord } from './recommendations'

type RecommendationResultRow = {
  itemId: string
  result: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecommendationRecord(value: unknown): value is RecommendationRecord {
  if (!isRecord(value)) return false
  const observation = value.observation
  const financialImpact = value.financialImpact
  const suggestedAction = value.suggestedAction
  const evidenceTraceRef = value.evidenceTraceRef

  return (
    value.version === 1 &&
    typeof value.itemId === 'string' &&
    typeof value.itemName === 'string' &&
    typeof value.rank === 'number' &&
    typeof value.score === 'string' &&
    isRecord(observation) &&
    typeof observation.unit === 'string' &&
    isRecord(observation.scores) &&
    isRecord(financialImpact) &&
    financialImpact.currency === 'USD' &&
    isRecord(suggestedAction) &&
    suggestedAction.framing === 'consider' &&
    typeof suggestedAction.timeHorizon === 'string' &&
    isRecord(evidenceTraceRef) &&
    typeof evidenceTraceRef.key === 'string'
  )
}

/** Sorts persisted recommendations defensively before they reach a UI. */
export function buildDashboardRecommendations(
  rows: readonly RecommendationResultRow[],
  limit = 5,
) {
  return rows
    .flatMap(({ result }) => (isRecommendationRecord(result) ? [result] : []))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit)
}

/** Reads only the latest successful recommendations for an owned location. */
export async function getDashboardRecommendations(
  headers: Headers,
  locationId: string,
) {
  const { requireOwnedLocation } =
    await import('@/src/server/auth/authorization')
  const { db } = await import('@/src/server/db/client')
  const { metricResults } = await import('@/src/server/db/schema')
  const owned = await requireOwnedLocation(headers, locationId)
  const run = await getLatestSuccessfulMetricRun(owned.locationId)
  if (!run) return []

  const rows = await db
    .select({
      itemId: metricResults.inventoryItemId,
      result: metricResults.result,
    })
    .from(metricResults)
    .where(
      and(
        eq(metricResults.locationId, owned.locationId),
        eq(metricResults.runId, run.id),
        or(
          eq(metricResults.metricKey, 'recommendation'),
          eq(metricResults.metricKey, 'recommendation:margin-erosion'),
          eq(metricResults.metricKey, 'recommendation:recipe-variance'),
          eq(
            metricResults.metricKey,
            'recommendation:ingredient-cost-increase',
          ),
        ),
        eq(metricResults.status, 'calculated'),
      ),
    )
    .orderBy(asc(metricResults.inventoryItemId))

  return buildDashboardRecommendations(rows)
}
