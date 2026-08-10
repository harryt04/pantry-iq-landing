import type {
  EvidenceCalculation,
  EvidenceSourceInput,
} from '@/src/server/metrics/evidence'

const MIN_CORRELATION_OBSERVATIONS = 14
const MIN_ABSOLUTE_CORRELATION = 0.3
const CORRELATION_SCALE = 6

export type ExternalSignalKind = 'weather' | 'event'
export type ExternalSignalStatus = 'observed' | 'forecast'

/** One normalized feature from a provider response. Values stay decimal strings. */
export type ExternalSignalInput = {
  id: string
  kind: ExternalSignalKind
  source: string
  externalId: string
  businessDate: string
  status: ExternalSignalStatus
  feature: string
  condition: string
  value: string
  retrievedAt: Date
  validFrom: Date
  validTo: Date
  sourceUrl?: string | null
  rawData?: Record<string, unknown>
  costMicros?: string
  currency?: string
}

export type SignalSalesPoint = {
  businessDate: string
  sales: string
}

export type ExternalSignalCorrelation = {
  key: string
  kind: ExternalSignalKind
  source: string
  feature: string
  observations: number
  coefficient: string | null
  qualified: boolean
  reason: string
}

export type ExternalSignalInfluence = {
  status: 'applied' | 'not-demonstrated' | 'unavailable'
  correlations: ExternalSignalCorrelation[]
  appliedCount: number
  traceCalculations: EvidenceCalculation[]
  sources: EvidenceSourceInput[]
}

function decimal(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rounded(value: number): string {
  return value.toFixed(CORRELATION_SCALE)
}

function correlation(values: readonly number[], outcomes: readonly number[]) {
  if (values.length < MIN_CORRELATION_OBSERVATIONS) return null
  const valueMean = values.reduce((sum, item) => sum + item, 0) / values.length
  const outcomeMean =
    outcomes.reduce((sum, item) => sum + item, 0) / outcomes.length
  let numerator = 0
  let valueVariance = 0
  let outcomeVariance = 0
  for (let index = 0; index < values.length; index += 1) {
    const valueDelta = values[index]! - valueMean
    const outcomeDelta = outcomes[index]! - outcomeMean
    numerator += valueDelta * outcomeDelta
    valueVariance += valueDelta * valueDelta
    outcomeVariance += outcomeDelta * outcomeDelta
  }
  if (valueVariance === 0 || outcomeVariance === 0) return null
  return numerator / Math.sqrt(valueVariance * outcomeVariance)
}

function signalKey(
  signal: Pick<ExternalSignalInput, 'kind' | 'source' | 'feature'>,
) {
  return `${signal.kind}:${signal.source}:${signal.feature}`
}

/**
 * Correlation is a gate, not a weighting knob. A provider feature must have
 * enough paired dates and a meaningful coefficient before it can select
 * comparable historical periods for a forecast.
 */
export function measureExternalSignalCorrelations(
  signals: readonly ExternalSignalInput[],
  sales: readonly SignalSalesPoint[],
): ExternalSignalCorrelation[] {
  const salesByDate = new Map<string, number>()
  for (const point of sales) {
    const value = decimal(point.sales)
    if (value === null) continue
    salesByDate.set(
      point.businessDate,
      (salesByDate.get(point.businessDate) ?? 0) + value,
    )
  }

  const groups = new Map<string, ExternalSignalInput[]>()
  for (const signal of signals) {
    const rows = groups.get(signalKey(signal)) ?? []
    rows.push(signal)
    groups.set(signalKey(signal), rows)
  }

  return [...groups.entries()].map(([key, rows]) => {
    const byDate = new Map<string, ExternalSignalInput>()
    for (const row of rows) byDate.set(row.businessDate, row)
    const values: number[] = []
    const outcomes: number[] = []
    for (const [date, salesValue] of salesByDate) {
      const signal = byDate.get(date)
      const signalValue = signal ? decimal(signal.value) : null
      if (signalValue === null) continue
      values.push(signalValue)
      outcomes.push(salesValue)
    }
    const coefficient = correlation(values, outcomes)
    const qualified =
      coefficient !== null && Math.abs(coefficient) >= MIN_ABSOLUTE_CORRELATION
    const first = rows[0]
    const reason =
      coefficient === null
        ? values.length < MIN_CORRELATION_OBSERVATIONS
          ? `needs ${MIN_CORRELATION_OBSERVATIONS} paired dates; found ${values.length}`
          : 'the signal or sales values do not vary enough to measure correlation'
        : qualified
          ? `correlation ${rounded(coefficient)} clears the ±${MIN_ABSOLUTE_CORRELATION} threshold`
          : `correlation ${rounded(coefficient)} does not clear the ±${MIN_ABSOLUTE_CORRELATION} threshold`
    return {
      key,
      kind: first?.kind ?? 'weather',
      source: first?.source ?? 'unknown',
      feature: first?.feature ?? 'unknown',
      observations: values.length,
      coefficient: coefficient === null ? null : rounded(coefficient),
      qualified,
      reason,
    }
  })
}

function sourceInputs(
  signals: readonly ExternalSignalInput[],
): EvidenceSourceInput[] {
  const bySource = new Map<string, ExternalSignalInput[]>()
  for (const signal of signals) {
    const rows = bySource.get(signal.source) ?? []
    rows.push(signal)
    bySource.set(signal.source, rows)
  }
  return [...bySource.entries()].map(([source, rows]) => ({
    filename: `${source} external signals`,
    source,
    rowCount: rows.length,
    uploadedAt: rows.reduce(
      (latest, row) => (row.retrievedAt > latest ? row.retrievedAt : latest),
      rows[0]?.retrievedAt ?? new Date(0),
    ),
  }))
}

export function evaluateExternalSignals(
  signals: readonly ExternalSignalInput[],
  sales: readonly SignalSalesPoint[],
): ExternalSignalInfluence {
  if (signals.length === 0) {
    return {
      status: 'unavailable',
      correlations: [],
      appliedCount: 0,
      traceCalculations: [],
      sources: [],
    }
  }

  const correlations = measureExternalSignalCorrelations(signals, sales)
  const qualified = new Set(
    correlations
      .filter((result) => result.qualified)
      .map((result) => result.key),
  )
  return {
    status: qualified.size > 0 ? 'applied' : 'not-demonstrated',
    correlations,
    appliedCount: qualified.size,
    traceCalculations: correlations.map((result) => ({
      id: `external-signal:correlation:${result.key}`,
      operator:
        'Pearson correlation between signal feature and daily imported sales',
      inputs: {
        kind: result.kind,
        source: result.source,
        feature: result.feature,
        observations: String(result.observations),
        threshold: String(MIN_ABSOLUTE_CORRELATION),
      },
      units: { coefficient: 'correlation', sales: 'currency' },
      result: result.coefficient,
      explanation: result.reason,
    })),
    sources: sourceInputs(signals),
  }
}

export function signalGroupKey(
  signal: Pick<ExternalSignalInput, 'kind' | 'source' | 'feature'>,
) {
  return signalKey(signal)
}
