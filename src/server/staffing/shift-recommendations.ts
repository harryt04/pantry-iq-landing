import type {
  EvidenceAssumption,
  EvidenceSourceInput,
} from '@/src/server/metrics/evidence'
import {
  assembleStaffingRecommendationRecords,
  type StaffingRecommendationRecord,
  type StaffingRecommendationDraft,
  type StaffingRisk,
} from '@/src/server/metrics/recommendations'
import { rankRecommendations } from '@/src/server/metrics/ranking'
import { calculateImpact } from '@/src/server/metrics/impact'

import type { DemandForecastResult } from './demand-forecast'
import type { LaborEfficiencyShift } from './labor-efficiency'

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const RATIO_SCALE = 6
const DAY_PARTS = [
  { key: 'morning', label: 'Morning', start: 0, end: 420 },
  { key: 'midday', label: 'Midday', start: 420, end: 720 },
  { key: 'evening', label: 'Evening', start: 720, end: 1080 },
  { key: 'overnight', label: 'Overnight', start: 1080, end: 1440 },
] as const

type Decimal = { coefficient: bigint; scale: number }

type RoleHistory = {
  role: string
  dayPartKey: string
  dayPartLabel: string
  sales: string
  actualHours: string
  scheduledHours: string | null
  scheduledObservations: number
  laborCost: string | null
  laborCostObservations: number
  observations: number
}

export type ShiftRecommendationInput = {
  forecast: DemandForecastResult
  sales: readonly { transactedAt: Date | string; revenue: string }[]
  labor: readonly LaborEfficiencyShift[]
  timezone: string
  businessDayBoundary: string
  sources?: readonly EvidenceSourceInput[]
  asOf?: Date
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

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return normalize({
    coefficient:
      left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  })
}

function subtract(left: Decimal, right: Decimal): Decimal {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
}

function divide(left: Decimal, right: Decimal, scale = RATIO_SCALE): Decimal {
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

function decimalToString(value: Decimal) {
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

function sum(values: readonly string[]) {
  if (values.length === 0) return null
  let total: Decimal = { coefficient: 0n, scale: 0 }
  for (const value of values) {
    const parsed = parseDecimal(value)
    if (!parsed) return null
    total = add(total, parsed)
  }
  return decimalToString(total)
}

function dateValue(value: Date | string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function localParts(timestamp: Date, timezone: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(timestamp)
        .map((part) => [part.type, part.value]),
    )
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    }
  } catch {
    return null
  }
}

function boundaryMinutes(boundary: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(boundary)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour > 23 || minute > 59 ? null : hour * 60 + minute
}

function dayPartFor(
  timestamp: Date,
  timezone: string,
  boundary: string,
): (typeof DAY_PARTS)[number] | null {
  const boundaryValue = boundaryMinutes(boundary)
  const local = localParts(timestamp, timezone)
  if (boundaryValue === null || !local) return null
  const relativeMinutes =
    (local.hour * 60 + local.minute - boundaryValue + 1440) % 1440
  return (
    DAY_PARTS.find(
      (part) => relativeMinutes >= part.start && relativeMinutes < part.end,
    ) ?? null
  )
}

function risk(
  baseline: string | null,
  bound: string | null,
  direction: 'under' | 'over',
): StaffingRisk {
  if (baseline === null || bound === null)
    return {
      status: 'cannot-calculate',
      detail:
        'A comparable scheduled-hours baseline or forecast error range is not available.',
    }
  const baselineValue = parseDecimal(baseline)
  const boundValue = parseDecimal(bound)
  if (!baselineValue || !boundValue)
    return {
      status: 'cannot-calculate',
      detail: 'The imported hours could not be compared exactly.',
    }
  const comparison = subtract(baselineValue, boundValue).coefficient
  const indicated = direction === 'under' ? comparison < 0n : comparison > 0n
  return indicated
    ? {
        status: 'possible',
        detail:
          direction === 'under'
            ? 'Usual planned hours sit below the lower forecast range.'
            : 'Usual planned hours sit above the upper forecast range.',
      }
    : {
        status: 'not-indicated',
        detail:
          direction === 'under'
            ? 'Usual planned hours are not below the lower forecast range.'
            : 'Usual planned hours are not above the upper forecast range.',
      }
}

function roleHistories(input: ShiftRecommendationInput): RoleHistory[] {
  const validShifts = input.labor.flatMap((shift) => {
    const start = dateValue(shift.shiftStart)
    const end = shift.shiftEnd ? dateValue(shift.shiftEnd) : null
    const dayPart = start
      ? dayPartFor(start, input.timezone, input.businessDayBoundary)
      : null
    return start && end && end > start && dayPart
      ? [{ shift, start, end, dayPart }]
      : []
  })
  const salesByShift = new Map<string, string[]>()
  for (const sale of input.sales) {
    const timestamp = dateValue(sale.transactedAt)
    if (!timestamp || !parseDecimal(sale.revenue)) continue
    const matches = validShifts.filter(
      ({ start, end }) => timestamp >= start && timestamp < end,
    )
    if (matches.length === 1) {
      const shiftId = matches[0]!.shift.id
      salesByShift.set(shiftId, [
        ...(salesByShift.get(shiftId) ?? []),
        sale.revenue,
      ])
    }
  }

  const grouped = new Map<string, RoleHistory>()
  for (const { shift, dayPart } of validShifts) {
    const actualHours = shift.actualHours
      ? parseDecimal(shift.actualHours)
      : undefined
    if (!actualHours || actualHours.coefficient <= 0n) continue
    const sales = sum(salesByShift.get(shift.id) ?? [])
    if (sales === null) continue
    const role = shift.role.trim() || 'Unspecified role'
    const key = `${role}\u0000${dayPart.key}`
    const existing = grouped.get(key)
    const scheduled = shift.scheduledHours
      ? parseDecimal(shift.scheduledHours)
      : undefined
    const nextSales = sum([existing?.sales ?? '0', sales])!
    const nextActual = sum([
      existing?.actualHours ?? '0',
      decimalToString(actualHours),
    ])!
    const scheduledValue =
      scheduled && shift.scheduledHours ? shift.scheduledHours : null
    const scheduledValues = scheduledValue
      ? [existing?.scheduledHours ?? '0', scheduledValue]
      : []
    grouped.set(key, {
      role,
      dayPartKey: dayPart.key,
      dayPartLabel: dayPart.label,
      sales: nextSales,
      actualHours: nextActual,
      scheduledHours: scheduledValues.length > 0 ? sum(scheduledValues) : null,
      scheduledObservations:
        (existing?.scheduledObservations ?? 0) + (scheduled ? 1 : 0),
      laborCost:
        existing?.laborCost === null
          ? null
          : shift.laborCost && parseDecimal(shift.laborCost)
            ? sum([existing?.laborCost ?? '0', shift.laborCost])
            : null,
      laborCostObservations:
        (existing?.laborCostObservations ?? 0) +
        (shift.laborCost && parseDecimal(shift.laborCost) ? 1 : 0),
      observations: (existing?.observations ?? 0) + 1,
    })
  }

  return [...grouped.values()].filter((history) => {
    const sales = parseDecimal(history.sales)
    const hours = parseDecimal(history.actualHours)
    return Boolean(
      sales && hours && sales.coefficient > 0n && hours.coefficient > 0n,
    )
  })
}

function scoreSpread(
  lowerHours: string | null,
  upperHours: string | null,
  recommendedHours: string,
) {
  if (lowerHours === null || upperHours === null) return '0'
  const lower = parseDecimal(lowerHours)
  const upper = parseDecimal(upperHours)
  const recommended = parseDecimal(recommendedHours)
  if (!lower || !upper || !recommended) return '0'
  const denominator =
    recommended.coefficient > 0n ? recommended : { coefficient: 1n, scale: 0 }
  const score = divide(
    multiply(subtract(upper, lower), { coefficient: 100n, scale: 0 }),
    denominator,
    0,
  )
  return score.coefficient > 100n ? '100' : decimalToString(score)
}

export function buildShiftRecommendations(
  input: ShiftRecommendationInput,
): StaffingRecommendationRecord[] {
  if (input.forecast.status !== 'calculated') return []
  const histories = roleHistories(input)
  const drafts: StaffingRecommendationDraft[] = []

  for (const [periodIndex, period] of input.forecast.periods.entries()) {
    if (period.sales.status !== 'calculated' || period.sales.value === null)
      continue
    const part = DAY_PARTS.find(
      (candidate) => candidate.label === period.dayPart,
    )
    if (!part) continue
    for (const history of histories.filter(
      (candidate) => candidate.dayPartKey === part.key,
    )) {
      const sales = parseDecimal(period.sales.value)
      const productivity = parseDecimal(history.sales)
        ? divide(
            parseDecimal(history.sales)!,
            parseDecimal(history.actualHours)!,
          )
        : null
      if (!sales || !productivity || productivity.coefficient <= 0n) continue
      const recommendedHours = decimalToString(divide(sales, productivity))
      const mae =
        input.forecast.accuracy.salesMae === null
          ? null
          : parseDecimal(input.forecast.accuracy.salesMae)
      const lowerSales = mae
        ? decimalToString(
            subtract(sales, mae).coefficient < 0n
              ? { coefficient: 0n, scale: 0 }
              : subtract(sales, mae),
          )
        : null
      const upperSales = mae ? decimalToString(add(sales, mae)) : null
      const lowerHours =
        lowerSales === null
          ? null
          : decimalToString(divide(parseDecimal(lowerSales)!, productivity))
      const upperHours =
        upperSales === null
          ? null
          : decimalToString(divide(parseDecimal(upperSales)!, productivity))
      const baselineScheduledHours =
        history.scheduledHours === null || history.scheduledObservations === 0
          ? null
          : decimalToString(
              divide(parseDecimal(history.scheduledHours)!, {
                coefficient: BigInt(history.scheduledObservations),
                scale: 0,
              }),
            )
      const uncertaintyStatus =
        lowerHours === null ? 'cannot-calculate' : 'calculated'
      const uncertaintyDetail =
        uncertaintyStatus === 'calculated'
          ? `Sales MAE of ${input.forecast.accuracy.salesMae} USD creates a ${lowerHours}–${upperHours} hour range.`
          : 'A forecast error range is not available yet; the hours suggestion is based on the point forecast only.'
      const impact = scoreSpread(lowerHours, upperHours, recommendedHours)
      const laborImpact =
        history.laborCost !== null &&
        history.scheduledHours !== null &&
        history.scheduledObservations === history.observations &&
        history.laborCostObservations === history.observations
          ? calculateImpact({
              laborCost: history.laborCost,
              actualHours: history.actualHours,
              scheduledHours: history.scheduledHours,
              currency: 'USD',
            })
          : null
      const impactScore =
        laborImpact?.status === 'calculated' ? laborImpact.value : impact
      drafts.push({
        id: `${period.id}:${history.role}`,
        role: history.role,
        businessDate: period.businessDate,
        dayPart: period.dayPart,
        forecastSales: period.sales.value,
        forecastBasis: period.basis,
        referencePeriods: period.referencePeriods,
        historicalSalesPerLaborHour: decimalToString(productivity),
        historicalObservations: history.observations,
        baselineScheduledHours,
        uncertainty: {
          status: uncertaintyStatus,
          salesMae: input.forecast.accuracy.salesMae,
          lowerSales,
          upperSales,
          lowerHours,
          upperHours,
          detail: uncertaintyDetail,
        },
        recommendedHours,
        risks: {
          understaffing: risk(baselineScheduledHours, lowerHours, 'under'),
          overstaffing: risk(baselineScheduledHours, upperHours, 'over'),
        },
        scores: {
          impact: impactScore,
          urgency: String(Math.max(10, 100 - periodIndex * 10)),
          dataSufficiency: String(Math.min(100, history.observations * 20)),
        },
        evidenceMetrics: [
          {
            metricKey: 'staffingForecast',
            status: 'calculated',
            value: period.sales.value,
            result: {
              status: 'calculated',
              value: period.sales.value,
              inputs: {
                businessDate: period.businessDate,
                dayPart: period.dayPart,
                referencePeriods: String(period.referencePeriods),
              },
              units: { value: 'USD forecast sales' },
            },
          },
          {
            metricKey: 'staffingProductivity',
            status: 'calculated',
            value: decimalToString(productivity),
            result: {
              status: 'calculated',
              value: decimalToString(productivity),
              inputs: {
                historicalSales: history.sales,
                historicalActualHours: history.actualHours,
                observations: String(history.observations),
              },
              units: { value: 'USD per labor hour' },
            },
          },
          {
            metricKey: 'staffingUncertainty',
            status: uncertaintyStatus,
            value: uncertaintyStatus === 'calculated' ? upperHours : null,
            result:
              uncertaintyStatus === 'calculated'
                ? {
                    status: 'calculated',
                    value: upperHours,
                    inputs: {
                      salesMae: input.forecast.accuracy.salesMae!,
                      recommendedHours,
                    },
                    units: { value: 'labor hours range' },
                  }
                : {
                    status: 'cannot-calculate',
                    reason: uncertaintyDetail,
                    inputs: { recommendedHours },
                    units: { value: 'labor hours range' },
                  },
          },
          ...(laborImpact
            ? [
                {
                  metricKey: 'laborCostVariance',
                  status: laborImpact.status,
                  value:
                    laborImpact.status === 'calculated'
                      ? laborImpact.value
                      : null,
                  result: laborImpact,
                },
              ]
            : []),
        ],
        additionalAssumptions: [
          {
            name: 'staffing.recommendation',
            value:
              'suggestion only; PantryIQ never writes to a scheduling system',
            origin: 'system-default',
            editPath: 'Operator decision: scheduling workflow',
          },
          {
            name: 'staffing.productivity',
            value:
              'historical role and day-part sales divided by actual labor hours',
            origin: 'system-default',
            editPath: 'Import → labor shifts',
          },
          ...(laborImpact
            ? [
                {
                  name: 'staffing.laborCostVariance',
                  value:
                    'positive labor cost above the scheduled-hours baseline, using the observed labor cost per actual hour',
                  origin: 'system-default' as const,
                  editPath: 'Import → labor shifts',
                },
              ]
            : []),
        ] satisfies readonly EvidenceAssumption[],
      })
    }
  }

  const ranked = rankRecommendations(
    drafts.map((draft) => ({
      itemId: draft.id,
      dimensions: draft.scores,
    })),
  )
  const laborSource: EvidenceSourceInput = {
    filename: 'normalized labor shift records',
    source: 'labor_shifts',
    rowCount: input.labor.length,
    uploadedAt: input.asOf ?? new Date(),
  }
  return assembleStaffingRecommendationRecords({
    drafts,
    ranked,
    sources: [...(input.sources ?? []), laborSource],
    sourceTimestamp: input.asOf ?? new Date(),
  })
}
