import {
  buildPrecomputeResults,
  type PrecomputeInput,
  type PrecomputeItem,
  type PrecomputeOutput,
} from '@/src/server/metrics/precompute'

export type AssumptionField = 'shelfLifeDays' | 'costPerUnit'

export type AssumptionOverride = {
  itemId: string
  field: AssumptionField
  value: number | string
}

export type NormalizedAssumptionOverride = {
  itemId: string
  field: AssumptionField
  value: number | string
}

export type AssumptionFigure = {
  financialImpact: string | null
  recommendationScore: string | null
  urgencyScore: string | null
}

export type AssumptionComparison = {
  itemId: string
  itemName: string
  field: AssumptionField
  beforeValue: number | string | null
  afterValue: number | string
  before: AssumptionFigure
  after: AssumptionFigure
  calculation: 'deterministic-precompute'
}

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('An assumption override is required.')
  }
  return input as Record<string, unknown>
}

function requiredItemId(input: Record<string, unknown>) {
  if (typeof input.itemId !== 'string' || input.itemId.trim().length === 0) {
    throw new Error('An item is required for an assumption override.')
  }
  return input.itemId.trim()
}

function normalizedValue(
  field: AssumptionField,
  value: unknown,
): number | string {
  if (field === 'shelfLifeDays') {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value.trim())
          ? Number(value.trim())
          : Number.NaN
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error('Shelf life must be a non-negative whole number of days.')
    }
    return parsed
  }

  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value.trim())) {
    throw new Error('Cost per unit must be a non-negative decimal.')
  }
  return value.trim()
}

export function parseAssumptionOverride(
  input: unknown,
): NormalizedAssumptionOverride {
  const values = recordInput(input)
  const itemId = requiredItemId(values)
  if (values.field !== 'shelfLifeDays' && values.field !== 'costPerUnit') {
    throw new Error('That assumption cannot be changed from Chat.')
  }
  const field = values.field as AssumptionField
  return { itemId, field, value: normalizedValue(field, values.value) }
}

function itemWithOverride(
  item: PrecomputeItem,
  override: NormalizedAssumptionOverride,
): PrecomputeItem {
  if (override.field === 'shelfLifeDays') {
    return { ...item, shelfLifeDays: override.value as number }
  }
  return { ...item, costPerUnit: override.value as string }
}

export function applyAssumptionOverride(
  input: PrecomputeInput,
  override: NormalizedAssumptionOverride,
): PrecomputeInput {
  let found = false
  const items = input.items.map((item) => {
    if (item.id !== override.itemId) return item
    found = true
    return itemWithOverride(item, override)
  })
  if (!found) throw new Error('That item is not available in this location.')
  return { ...input, items }
}

function metricValue(output: PrecomputeOutput, itemId: string, key: string) {
  const item = output.itemResults.find((result) => result.itemId === itemId)
  return item?.metrics.find((metric) => metric.metricKey === key)?.value ?? null
}

function recommendationFigure(
  output: PrecomputeOutput,
  itemId: string,
): AssumptionFigure {
  const recommendation = output.recommendations.find(
    (candidate) => candidate.itemId === itemId,
  )
  return {
    financialImpact: recommendation?.financialImpact.amount ?? null,
    recommendationScore: recommendation?.score ?? null,
    urgencyScore: metricValue(output, itemId, 'urgency'),
  }
}

function currentValue(item: PrecomputeItem, field: AssumptionField) {
  return field === 'shelfLifeDays'
    ? (item.shelfLifeDays ?? null)
    : (item.costPerUnit ?? null)
}

export function compareAssumptionOverride(
  input: PrecomputeInput,
  override: NormalizedAssumptionOverride,
  now: Date,
): AssumptionComparison {
  const item = input.items.find((candidate) => candidate.id === override.itemId)
  if (!item) throw new Error('That item is not available in this location.')

  const before = buildPrecomputeResults(input, now)
  const after = buildPrecomputeResults(
    applyAssumptionOverride(input, override),
    now,
  )
  return {
    itemId: item.id,
    itemName: item.displayName ?? item.id,
    field: override.field,
    beforeValue: currentValue(item, override.field),
    afterValue: override.value,
    before: recommendationFigure(before, item.id),
    after: recommendationFigure(after, item.id),
    calculation: 'deterministic-precompute',
  }
}
