type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const RATIO_SCALE = 4

export const comparisonMetricDefinitions = [
  { id: 'spoilageRate', label: 'Spoilage rate', unit: '%' },
  { id: 'margin', label: 'Margin', unit: 'USD' },
  { id: 'sellThrough', label: 'Sell-through', unit: '%' },
  { id: 'moneyAtRisk', label: 'Money at risk', unit: 'USD' },
] as const

export type ComparisonMetricId =
  (typeof comparisonMetricDefinitions)[number]['id']

export type LocationComparisonInput = {
  locationId: string
  locationName: string
  period: { start: string; end: string } | null
  dataSufficiency: {
    status: 'calculated' | 'cannot-calculate'
    value: string | null
  }
  metrics: Record<ComparisonMetricId, string | null>
}

export type ComparisonMetricLocation = {
  locationId: string
  locationName: string
  status: 'calculated' | 'cannot-calculate'
  value: string | null
  chartValue: number | null
  valueLabel: string
  reason?: string
}

export type LocationComparisonMetric = {
  id: ComparisonMetricId
  label: string
  unit: string
  locations: readonly ComparisonMetricLocation[]
}

export type LocationComparison = {
  status: 'ready' | 'period-mismatch' | 'no-data'
  period: { start: string; end: string } | null
  periodMismatchLocations: readonly string[]
  coverage: 'matched' | 'varied'
  locations: readonly {
    locationId: string
    locationName: string
    dataSufficiency: string | null
    dataSufficiencyLabel: string
  }[]
  metrics: readonly LocationComparisonMetric[]
}

function parseDecimal(value: string): Decimal | undefined {
  if (!DECIMAL_PATTERN.test(value)) return undefined
  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integer = '0', fraction = ''] = unsigned.split('.')
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '')
  return {
    coefficient: BigInt(digits || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function normalize(decimal: Decimal): Decimal {
  let coefficient = decimal.coefficient
  let scale = decimal.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function decimalToString(decimal: Decimal) {
  const normalized = normalize(decimal)
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

function divide(
  left: Decimal,
  right: Decimal,
  scale: number,
): Decimal | undefined {
  if (right.coefficient === 0n) return undefined
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

function nonNegative(value: string) {
  const parsed = parseDecimal(value)
  if (!parsed) return undefined
  return parsed.coefficient < 0n ? '0' : decimalToString(parsed)
}

/** Converts persisted spoilage units and ordered quantity into an exact rate. */
export function spoilageRateFromTotals(
  spoilage: string | null,
  orderedQuantity: string | null,
) {
  if (spoilage === null || orderedQuantity === null) return null
  const spoilageValue = nonNegative(spoilage)
  const ordered = parseDecimal(orderedQuantity)
  if (spoilageValue === undefined || !ordered || ordered.coefficient <= 0n)
    return null
  const parsedSpoilage = parseDecimal(spoilageValue)
  if (!parsedSpoilage) return null
  return decimalToString(
    divide(
      {
        coefficient: parsedSpoilage.coefficient * 100n,
        scale: parsedSpoilage.scale,
      },
      ordered,
      RATIO_SCALE,
    ) ?? { coefficient: 0n, scale: 0 },
  )
}

function chartValue(value: string | null) {
  if (value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function valueLabel(value: string | null, unit: string) {
  if (value === null) return 'Not available'
  if (unit !== 'USD') return `${value}${unit}`
  return value.startsWith('-') ? `-$${value.slice(1)}` : `$${value}`
}

function samePeriod(locations: readonly LocationComparisonInput[]): {
  period: { start: string; end: string } | null
  mismatches: string[]
} {
  const first = locations[0]?.period ?? null
  if (!first) {
    return {
      period: null,
      mismatches: locations.map(({ locationName }) => locationName),
    }
  }
  const mismatches = locations
    .filter(
      ({ period }) =>
        !period || period.start !== first.start || period.end !== first.end,
    )
    .map(({ locationName }) => locationName)
  return { period: mismatches.length > 0 ? null : first, mismatches }
}

export function buildLocationComparison(
  locations: readonly LocationComparisonInput[],
): LocationComparison {
  const coverageValues = locations.map(({ dataSufficiency }) =>
    dataSufficiency.status === 'calculated' && dataSufficiency.value !== null
      ? dataSufficiency.value
      : null,
  )
  const coverage = coverageValues.every((value) => value === coverageValues[0])
    ? 'matched'
    : 'varied'
  const period = samePeriod(locations)
  const locationSummaries = locations.map((location, index) => ({
    locationId: location.locationId,
    locationName: location.locationName,
    dataSufficiency: coverageValues[index] ?? null,
    dataSufficiencyLabel:
      coverageValues[index] === null
        ? 'Data sufficiency unavailable'
        : `Data sufficiency ${coverageValues[index]}/100`,
  }))

  if (locations.length === 0) {
    return {
      status: 'no-data',
      period: null,
      periodMismatchLocations: [],
      coverage: 'varied',
      locations: [],
      metrics: [],
    }
  }

  if (period.mismatches.length > 0) {
    return {
      status: 'period-mismatch',
      period: null,
      periodMismatchLocations: period.mismatches,
      coverage,
      locations: locationSummaries,
      metrics: [],
    }
  }

  return {
    status: 'ready',
    period: period.period,
    periodMismatchLocations: [],
    coverage,
    locations: locationSummaries,
    metrics: comparisonMetricDefinitions.map((definition) => ({
      ...definition,
      locations: locations.map((location) => {
        const value = location.metrics[definition.id]
        const status = value === null ? 'cannot-calculate' : 'calculated'
        return {
          locationId: location.locationId,
          locationName: location.locationName,
          status,
          value,
          chartValue: chartValue(value),
          valueLabel: valueLabel(value, definition.unit),
          ...(value === null ? { reason: 'Not enough imported data.' } : {}),
        }
      }),
    })),
  }
}
