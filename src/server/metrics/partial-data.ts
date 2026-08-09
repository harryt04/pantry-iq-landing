import { METRICS_CONFIG } from './config'

export type PartialDataFindingCode =
  | 'insufficient-history'
  | 'missing-prices'
  | 'conflicting-data'
  | 'seasonal-pattern'

export type PartialDataFinding = {
  code: PartialDataFindingCode
  message: string
  details: Record<string, string>
}

type MetricResultShape = {
  metricKey: string
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  result: unknown
}

type ObjectRecord = Record<string, unknown>

export type PartialDataSale = {
  qty: string
  transactedAt: Date
}

function isRecord(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metricResult(
  metrics: readonly MetricResultShape[],
  metricKey: string,
): ObjectRecord | undefined {
  const metric = metrics.find((candidate) => candidate.metricKey === metricKey)
  return metric && isRecord(metric.result) ? metric.result : undefined
}

function stringValue(record: ObjectRecord | undefined, key: string) {
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}

function recordValue(record: ObjectRecord | undefined, key: string) {
  const value = record?.[key]
  return isRecord(value) ? value : undefined
}

function weeksLabel(value: string) {
  return `${value} ${value === '1' ? 'week' : 'weeks'}`
}

function hasNonZeroQuantity(value: string | undefined) {
  if (value === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    return false
  const [integer = '0', fraction = ''] = value.replace(/^[+-]/, '').split('.')
  return `${integer}${fraction}`.replace(/^0+/, '') !== ''
}

function historyFinding(
  metrics: readonly MetricResultShape[],
): PartialDataFinding | undefined {
  const result = metricResult(metrics, 'dataSufficiency')
  if (!result || result.predictionEligible === true) return undefined

  const inputs = recordValue(result, 'inputs')
  const historyWeeks = stringValue(inputs, 'historyWeeks') ?? '0'
  const minimumHistoryWeeks =
    stringValue(inputs, 'predictionHistoryWeeks') ??
    String(METRICS_CONFIG.sufficiency.predictionHistoryWeeks)

  return {
    code: 'insufficient-history',
    message: `There are ${weeksLabel(historyWeeks)} of transaction history here, so this is an observation rather than a prediction.`,
    details: {
      historyWeeks,
      requiredHistoryWeeks: minimumHistoryWeeks,
      missing: 'transaction history',
      supply: `Add ${weeksLabel(minimumHistoryWeeks)} of transactions to enable a prediction.`,
    },
  }
}

function missingPricesFinding(
  metrics: readonly MetricResultShape[],
  quantities: readonly (string | null)[],
  unit: string,
): PartialDataFinding | undefined {
  const impact = metricResult(metrics, 'impact')
  if (!impact || impact.dollarsAvailable === true) return undefined
  if (!quantities.some((quantity) => hasNonZeroQuantity(quantity ?? undefined)))
    return undefined

  const inputs = recordValue(impact, 'inputs')
  const unitCost = stringValue(inputs, 'unitCost')
  const costOfSales = stringValue(inputs, 'costOfSales')
  if (unitCost !== undefined || costOfSales !== undefined) return undefined

  return {
    code: 'missing-prices',
    message: `I can't calculate a dollar impact for this item because its unit cost is missing. The quantities stay in ${unit}.`,
    details: {
      missing: 'unit cost',
      unit,
      supply:
        'Add a unit cost to the item or include purchase-order costs in the next import.',
    },
  }
}

function conflictingDataFindings(
  metrics: readonly MetricResultShape[],
  unit: string,
): PartialDataFinding[] {
  const spoilage = metricResult(metrics, 'spoilageEstimate')
  const resolution = recordValue(spoilage, 'resolution')
  const variances = resolution?.variances
  if (!Array.isArray(variances)) return []

  return variances.flatMap((value) => {
    if (!isRecord(value)) return []
    const difference = stringValue(value, 'difference')
    const snapshotValue = stringValue(value, 'snapshotValue')
    const inferredValue = stringValue(value, 'inferredValue')
    const start = stringValue(value, 'start')
    const end = stringValue(value, 'end')
    if (
      difference === undefined ||
      snapshotValue === undefined ||
      inferredValue === undefined ||
      start === undefined ||
      end === undefined
    )
      return []

    return [
      {
        code: 'conflicting-data',
        message: `There is a ${difference} ${unit} variance between the physical count and the order-and-sales calculation.`,
        details: {
          difference,
          unit,
          periodStart: start,
          periodEnd: end,
          physicalCountResult: snapshotValue,
          orderAndSalesResult: inferredValue,
          possibleExplanations:
            'Waste, a count timing difference, theft, or a data entry difference could explain the variance.',
          supply:
            'Review the physical count and the rows in this period before deciding which explanation fits.',
        },
      },
    ]
  })
}

const SEASONS = [
  { label: 'winter', months: new Set([12, 1, 2]) },
  { label: 'spring', months: new Set([3, 4, 5]) },
  { label: 'summer', months: new Set([6, 7, 8]) },
  { label: 'fall', months: new Set([9, 10, 11]) },
] as const

function seasonalFinding(
  sales: readonly PartialDataSale[],
  currentDate: Date,
): PartialDataFinding | undefined {
  const validSales = sales.filter(
    (sale) =>
      Number.isFinite(sale.transactedAt.getTime()) &&
      hasNonZeroQuantity(sale.qty),
  )
  if (validSales.length === 0) return undefined

  const firstSale = validSales.reduce(
    (earliest, sale) =>
      sale.transactedAt < earliest ? sale.transactedAt : earliest,
    validSales[0]?.transactedAt ?? currentDate,
  )
  const historyDays = Math.floor(
    (currentDate.getTime() - firstSale.getTime()) / (24 * 60 * 60 * 1000),
  )
  if (historyDays < 56) return undefined

  const activeMonths = new Set(
    validSales.map((sale) => sale.transactedAt.getUTCMonth() + 1),
  )
  const currentMonth = currentDate.getUTCMonth() + 1
  if (activeMonths.has(currentMonth) || activeMonths.size > 3) return undefined

  const season = SEASONS.find((candidate) =>
    [...activeMonths].every((month) => candidate.months.has(month)),
  )
  const activePeriod = season
    ? season.label
    : [...activeMonths].sort((left, right) => left - right).join(', ')
  const currentMonthLabel = currentDate.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })

  return {
    code: 'seasonal-pattern',
    message: `Sales for this item appear limited to ${activePeriod} months, and there are no sales in ${currentMonthLabel}. It may be seasonal; the historical data is still shown.`,
    details: {
      activePeriod,
      currentMonth: currentMonthLabel,
      activeMonthCount: String(activeMonths.size),
      explanation:
        'Seasonality is an observation from imported transaction dates, not a certainty.',
      supply:
        'Check whether the item is still on the menu before ordering more.',
    },
  }
}

export function buildPartialDataFindings(input: {
  metrics: readonly MetricResultShape[]
  unit: string
  sales?: readonly PartialDataSale[]
  currentDate: Date
  quantities?: readonly (string | null)[]
}): PartialDataFinding[] {
  const quantities = input.quantities ?? []
  const findings = [
    historyFinding(input.metrics),
    missingPricesFinding(input.metrics, quantities, input.unit),
    ...conflictingDataFindings(input.metrics, input.unit),
    seasonalFinding(input.sales ?? [], input.currentDate),
  ]

  return findings.filter(
    (finding): finding is PartialDataFinding => finding !== undefined,
  )
}
