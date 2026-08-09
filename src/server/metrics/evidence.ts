import type { MetricsConfig } from './config'
import type { RankedRecommendation } from './ranking'

export type EvidenceSourceInput = {
  filename: string
  source: string
  rowCount: number
  uploadedAt: Date
}

export type EvidenceSource = {
  filename: string
  source: string
  rowCount: number
  uploadedAt: string
}

export type EvidenceCalculation = {
  id: string
  operator: string
  inputs: Record<string, string>
  units: Record<string, string>
  result: string | null
  rounding?: string
  explanation?: string
}

export type EvidenceAssumption = {
  name: string
  value: string
  origin: 'user-set' | 'category-default' | 'system-default'
  editPath: string
}

export type EvidenceTrace = {
  version: 1
  sources: EvidenceSource[]
  calculations: EvidenceCalculation[]
  assumptions: EvidenceAssumption[]
}

type MetricResultShape = {
  metricKey: string
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  result: unknown
}

type ObjectRecord = Record<string, unknown>

const OPERATORS: Readonly<Record<string, string>> = {
  sellThrough: 'qtySold / qtyOrdered × 100',
  spoilageEstimate:
    'ordered − sold − onHand, using the recorded spoilage resolution',
  spoilageRisk: 'qtyOnHand × unitCost',
  margin: 'revenue − (qtySold × unitCost)',
  variance: '(qtyOrdered − qtySold − qtyOnHand) / qtyOrdered × 100',
  dataSufficiency: 'weighted mean of retained sufficiency components',
  impact: 'weighted mean of active impact category scores',
  urgency: 'weighted mean of urgency component scores',
}

function isRecord(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (typeof entry === 'string') return [[key, entry]]
      if (typeof entry === 'number' || typeof entry === 'boolean')
        return [[key, String(entry)]]
      return []
    }),
  )
}

function resultRecord(metric: MetricResultShape) {
  return isRecord(metric.result) ? metric.result : undefined
}

function calculationForMetric(metric: MetricResultShape): EvidenceCalculation {
  const result = resultRecord(metric)
  const inputs = stringRecord(result?.inputs)
  const units = stringRecord(result?.units)
  const reason = typeof result?.reason === 'string' ? result.reason : undefined
  const rounding =
    typeof result?.rounding === 'string' ? result.rounding : undefined
  return {
    id: `metric:${metric.metricKey}`,
    operator: OPERATORS[metric.metricKey] ?? `metric:${metric.metricKey}`,
    inputs,
    units,
    result: metric.status === 'calculated' ? metric.value : null,
    ...(rounding ? { rounding } : {}),
    ...(reason ? { explanation: reason } : {}),
  }
}

function nestedCalculations(metric: MetricResultShape): EvidenceCalculation[] {
  const result = resultRecord(metric)
  if (!result) return []
  const calculations: EvidenceCalculation[] = []

  for (const [groupName, groupValue] of [
    ['categories', result.categories],
    ['components', result.components],
  ] as const) {
    if (!isRecord(groupValue)) continue
    for (const [name, value] of Object.entries(groupValue)) {
      if (!isRecord(value)) continue
      const inputs = stringRecord(value.inputs)
      const score = typeof value.score === 'string' ? value.score : null
      const amount = typeof value.value === 'string' ? value.value : null
      if (amount !== null) {
        calculations.push({
          id: `metric:${metric.metricKey}.${name}.amount`,
          operator:
            groupName === 'categories'
              ? 'quantity or dollar input retained by the category calculation'
              : 'component amount retained by the metric calculation',
          inputs,
          units: { result: 'currency or quantity' },
          result: amount,
        })
      }
      if (score !== null) {
        calculations.push({
          id: `metric:${metric.metricKey}.${name}.score`,
          operator:
            groupName === 'categories'
              ? 'category amount × configured severity scale'
              : 'component score from the recorded inputs and thresholds',
          inputs,
          units: { result: 'score' },
          result: score,
        })
      }
    }
  }

  return calculations
}

function flattenConfig(
  value: unknown,
  path: string,
  output: EvidenceAssumption[],
  origin: EvidenceAssumption['origin'],
) {
  if (!isRecord(value)) {
    output.push({
      name: path,
      value: typeof value === 'string' ? value : String(value),
      origin,
      editPath: 'deployment configuration: PANTRYIQ_METRICS_CONFIG',
    })
    return
  }
  for (const key of Object.keys(value).sort()) {
    flattenConfig(value[key], `${path}.${key}`, output, origin)
  }
}

function assumptionsFor(
  config: MetricsConfig,
  shelfLifeDays: number | null | undefined,
): EvidenceAssumption[] {
  const assumptions: EvidenceAssumption[] = []
  flattenConfig(
    config,
    'metrics',
    assumptions,
    process.env.PANTRYIQ_METRICS_CONFIG ? 'user-set' : 'system-default',
  )
  assumptions.push({
    name: 'item.shelfLifeDays',
    value:
      shelfLifeDays === undefined || shelfLifeDays === null
        ? 'unset'
        : String(shelfLifeDays),
    origin:
      shelfLifeDays === undefined || shelfLifeDays === null
        ? 'system-default'
        : 'user-set',
    editPath: 'Settings → Item master → shelf life',
  })
  return assumptions
}

function fallbackSources(
  input: EvidenceSourceInput[] | undefined,
  counts: { transactions: number; purchaseOrders: number; snapshots: number },
  uploadedAt: Date,
): EvidenceSourceInput[] {
  if (input && input.length > 0) return input
  return [
    ...(counts.transactions > 0
      ? [
          {
            filename: 'normalized transaction records',
            source: 'transactions',
            rowCount: counts.transactions,
            uploadedAt,
          },
        ]
      : []),
    ...(counts.purchaseOrders > 0
      ? [
          {
            filename: 'normalized purchase-order records',
            source: 'purchase_orders',
            rowCount: counts.purchaseOrders,
            uploadedAt,
          },
        ]
      : []),
    ...(counts.snapshots > 0
      ? [
          {
            filename: 'normalized inventory snapshot records',
            source: 'inventory_snapshots',
            rowCount: counts.snapshots,
            uploadedAt,
          },
        ]
      : []),
    ...(counts.transactions === 0 &&
    counts.purchaseOrders === 0 &&
    counts.snapshots === 0
      ? [
          {
            filename: 'normalized recommendation inputs',
            source: 'normalized',
            rowCount: 1,
            uploadedAt,
          },
        ]
      : []),
  ]
}

function assertCompleteTrace(trace: EvidenceTrace) {
  if (trace.sources.length === 0)
    throw new Error('A recommendation requires at least one evidence source.')
  if (trace.calculations.length === 0)
    throw new Error('A recommendation requires at least one calculation.')
  if (trace.assumptions.length === 0)
    throw new Error('A recommendation requires recorded assumptions.')
  for (const source of trace.sources) {
    if (!source.filename || source.rowCount < 0 || !source.uploadedAt)
      throw new Error(
        'A recommendation source must include file, rows, and upload date.',
      )
  }
}

export function buildEvidenceTrace(input: {
  metrics: readonly MetricResultShape[]
  ranked: RankedRecommendation
  sources?: readonly EvidenceSourceInput[]
  sourceCounts: {
    transactions: number
    purchaseOrders: number
    snapshots: number
  }
  sourceTimestamp: Date
  shelfLifeDays?: number | null
  config: MetricsConfig
  additionalAssumptions?: readonly EvidenceAssumption[]
}): EvidenceTrace {
  const calculations = input.metrics.flatMap((metric) => [
    calculationForMetric(metric),
    ...nestedCalculations(metric),
  ])
  const dimensions = input.ranked.dimensions
  calculations.push({
    id: 'ranking:score',
    operator: `impact × ${input.config.ranking.weights.impact} + urgency × ${input.config.ranking.weights.urgency} + dataSufficiency × ${input.config.ranking.weights.dataSufficiency}`,
    inputs: {
      impact: dimensions.impact?.score ?? 'unavailable',
      urgency: dimensions.urgency?.score ?? 'unavailable',
      dataSufficiency: dimensions.dataSufficiency?.score ?? 'unavailable',
    },
    units: {
      impact: 'score',
      urgency: 'score',
      dataSufficiency: 'score',
      result: 'score',
    },
    result: input.ranked.score,
  })
  calculations.push({
    id: 'ranking:rank',
    operator:
      'deterministic ordering after score, impact, and item-ID tie-breaks',
    inputs: { score: input.ranked.score },
    units: { score: 'score', result: 'rank' },
    result: String(input.ranked.rank),
  })

  const sources = fallbackSources(
    input.sources ? [...input.sources] : undefined,
    input.sourceCounts,
    input.sourceTimestamp,
  )
    .sort((left, right) => {
      const timestamp = left.uploadedAt.getTime() - right.uploadedAt.getTime()
      return timestamp || left.filename.localeCompare(right.filename)
    })
    .map((source) => ({
      filename: source.filename,
      source: source.source,
      rowCount: source.rowCount,
      uploadedAt: source.uploadedAt.toISOString(),
    }))

  const trace = {
    version: 1,
    sources,
    calculations,
    assumptions: [
      ...assumptionsFor(input.config, input.shelfLifeDays),
      ...(input.additionalAssumptions ?? []),
    ],
  } satisfies EvidenceTrace
  assertCompleteTrace(trace)
  return trace
}
