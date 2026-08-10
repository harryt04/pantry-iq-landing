import type {
  EvidenceAssumption,
  EvidenceSource,
  EvidenceTrace,
} from '@/src/server/metrics/evidence'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

/**
 * The landing page shows a curated slice of the evidence trace, not all of it.
 *
 * The full trace is the right thing inside the product — an operator auditing a
 * number wants every step and every constant. On the marketing page it ran
 * roughly ten thousand pixels tall and ended in lines like
 * `metrics.impact.weights.laborCostVariance = 20`, which tells a stranger
 * nothing about their own kitchen.
 *
 * So this keeps three things: the arithmetic that produces the headline dollar
 * figure, the files it was read from, and the assumptions an operator can
 * actually change. Engine tuning constants stay in the app.
 */

export type MarketingWorkTerm = {
  /** Plain-English name for the input, never a variable name. */
  label: string
  value: string
}

export type MarketingWork = {
  /** The arithmetic, as the engine states it. */
  operator: string
  terms: MarketingWorkTerm[]
  result: string
  resultLabel: string
  sources: EvidenceSource[]
  assumptions: EvidenceAssumption[]
}

/** Which calculation produces the dollar figure on the card, per impact basis. */
const HEADLINE_CALCULATION: Record<
  RecommendationRecord['financialImpact']['basis'],
  string | null
> = {
  currentSpoilage: 'metric:spoilageRisk',
  historicalSpoilage: 'metric:spoilageEstimate',
  overordering: 'metric:variance',
  marginLoss: 'metric:margin',
  none: null,
}

/**
 * Input keys the engine emits, in plain English. Anything not named here is
 * dropped rather than shown under its variable name.
 */
const TERM_LABELS: Record<string, string> = {
  qtyOnHand: 'On hand at the last count',
  unitCost: 'Your unit cost',
  qtyOrdered: 'Ordered over the window',
  qtySold: 'Sold over the window',
  revenue: 'Revenue taken',
}

const RESULT_LABELS: Record<
  RecommendationRecord['financialImpact']['basis'],
  string
> = {
  currentSpoilage: 'At risk right now',
  historicalSpoilage: 'Lost to spoilage already',
  overordering: 'Ordered and not sold',
  marginLoss: 'Margin given up',
  none: 'Result',
}

export function assumptionOriginLabel(origin: EvidenceAssumption['origin']) {
  if (origin === 'user-set') return 'Your value'
  if (origin === 'category-default') return 'Category suggestion'
  return 'Our default, not a measurement'
}

function money(value: string) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : `$${value}`
}

function formatTermValue(value: string, unit: string | undefined) {
  if (!unit) return value
  if (unit === 'USD') return money(value)
  if (unit.startsWith('USD/')) return `${money(value)} / ${unit.slice(4)}`
  return `${value} ${unit}`
}

export function marketingWork(
  recommendation: RecommendationRecord,
): MarketingWork | null {
  const trace: EvidenceTrace | undefined = recommendation.evidenceTrace
  if (!trace) return null

  const calculationId =
    HEADLINE_CALCULATION[recommendation.financialImpact.basis]
  const calculation = calculationId
    ? trace.calculations.find(({ id }) => id === calculationId)
    : undefined
  if (!calculation || calculation.result === null) return null

  const terms = Object.entries(calculation.inputs)
    .flatMap(([key, value]) => {
      const label = TERM_LABELS[key]
      if (!label) return []
      return [{ label, value: formatTermValue(value, calculation.units[key]) }]
    })
    .sort((left, right) => left.label.localeCompare(right.label))
  if (terms.length === 0) return null

  return {
    operator: calculation.operator,
    terms,
    result: formatTermValue(
      calculation.result,
      calculation.units.value ?? calculation.units.result,
    ),
    resultLabel: RESULT_LABELS[recommendation.financialImpact.basis],
    sources: [...trace.sources].sort((left, right) =>
      left.filename.localeCompare(right.filename),
    ),
    // Engine tuning constants are not something an operator can act on, so they
    // never reach the marketing page. Item-level values are, so they do.
    assumptions: trace.assumptions.filter(({ name }) =>
      name.startsWith('item.'),
    ),
  }
}
