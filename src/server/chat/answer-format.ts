import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

const PART_LABELS = [
  'Observation',
  'Financial impact',
  'Prediction',
  'Recommendation',
  'Show your work',
] as const

const BANNED_LANGUAGE = [
  'revolutionary',
  'seamless',
  'effortless',
  'powerful',
  'robust',
  'unlock',
  'leverage',
  'supercharge',
  'game-changing',
  'best-in-class',
  'cutting-edge',
  'delight',
  'magic',
  'simply',
  'just',
  'obviously',
  'as you know',
  'ai-powered',
  'intelligent',
  'smart',
  'optimise',
  'optimize',
  'actually',
  'in fact',
  'i think',
  'i believe',
  'i feel',
  'invalid',
  'malformed',
  'corrupt',
  'incorrect',
  'failed to',
] as const

export type AnswerFormatCheck = {
  accepted: boolean
  reason:
    | 'ordered-sections'
    | 'first-two-sentences'
    | 'observation-confidence'
    | 'prediction-basis'
    | 'banned-language'
}

function containsBannedLanguage(text: string) {
  const normalized = text.toLocaleLowerCase()
  return BANNED_LANGUAGE.some((term) => {
    const expression = new RegExp(
      `(?:^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z])`,
      'i',
    )
    return expression.test(normalized)
  })
}

function partPosition(text: string, label: string) {
  return text.search(new RegExp(`(?:^|\\n)\\s*\\**${label}\\**\\s*:`, 'i'))
}

function firstTwoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ')
}

/**
 * Checks the presentation contract after the model has finished streaming.
 * Buffering is intentional: an answer is not shown until all five sections
 * and the trust-language checks have passed.
 */
export function checkAnswerFormat(text: string): AnswerFormatCheck {
  const positions = PART_LABELS.map((label) => partPosition(text, label))
  if (
    positions.some((position) => position < 0) ||
    positions.some((position, index) => {
      const next = positions[index + 1]
      return next !== undefined && position >= next
    })
  ) {
    return { accepted: false, reason: 'ordered-sections' }
  }

  const opening = firstTwoSentences(text)
  const carriesMoney =
    /\$\s*\d|dollar impact|no dollar impact|dollars? (?:are|is) not available/i.test(
      opening,
    )
  const carriesAction =
    /\b(?:consider|review|reduce|pull|watch|check|cut)\b/i.test(opening)
  if (!carriesMoney || !carriesAction) {
    return { accepted: false, reason: 'first-two-sentences' }
  }

  const observationStart = positions[0] ?? 0
  const financialStart = positions[1] ?? text.length
  const observation = text.slice(observationStart, financialStart)
  if (/\bconfidence\b|\b\d+%\s*(?:confident|sure|certain)/i.test(observation)) {
    return { accepted: false, reason: 'observation-confidence' }
  }

  const predictionStart = positions[2] ?? 0
  const recommendationStart = positions[3] ?? text.length
  const prediction = text.slice(predictionStart, recommendationStart)
  if (
    !/\b(?:not provided|not available|observation only|cannot|no prediction)\b/i.test(
      prediction,
    ) &&
    !/\b(?:based on|drawn from|from)\b.*\b(?:week|transaction|history)\b/i.test(
      prediction,
    )
  ) {
    return { accepted: false, reason: 'prediction-basis' }
  }

  if (containsBannedLanguage(text)) {
    return { accepted: false, reason: 'banned-language' }
  }

  return { accepted: true, reason: 'ordered-sections' }
}

function impactBasisLabel(
  basis: RecommendationRecord['financialImpact']['basis'],
) {
  if (basis === 'currentSpoilage') return 'current spoilage'
  if (basis === 'historicalSpoilage') return 'historical spoilage'
  if (basis === 'overordering') return 'overordering'
  if (basis === 'marginLoss') return 'margin loss'
  return 'the available data'
}

function observationFacts(recommendation: RecommendationRecord) {
  if (recommendation.menuFinding) {
    return `${recommendation.menuFinding.label}: ${recommendation.menuFinding.detail}`
  }
  const { observation } = recommendation
  if (
    observation.quantityOrdered !== null &&
    observation.quantitySold !== null &&
    observation.sellThroughRate !== null
  ) {
    return `Ordered ${observation.purchaseOrderCount} time${observation.purchaseOrderCount === 1 ? '' : 's'}, sold ${observation.quantitySold} ${observation.unit} (${observation.sellThroughRate}% sell-through).`
  }
  return 'Some quantities are unavailable in the imported data.'
}

function impactStatement(recommendation: RecommendationRecord) {
  const { financialImpact: impact } = recommendation
  if (impact.amount !== null) {
    return `About $${impact.amount} at risk from ${impactBasisLabel(impact.basis)}.`
  }
  return `Dollar impact is not available from ${impactBasisLabel(impact.basis)}.`
}

function actionStatement(recommendation: RecommendationRecord) {
  if (
    recommendation.suggestedAction.action ===
    'reduce-next-order-or-pull-from-menu'
  ) {
    return `Consider reducing the next order or reviewing ${recommendation.itemName} this week.`
  }
  return `Consider reviewing ${recommendation.itemName} this week.`
}

function recommendationAnswer(
  recommendation: RecommendationRecord,
  notice = '',
) {
  const impact = impactStatement(recommendation)
  const action = actionStatement(recommendation)
  const impactLead = recommendation.financialImpact.amount
    ? `about $${recommendation.financialImpact.amount} at risk from ${impactBasisLabel(recommendation.financialImpact.basis)}`
    : `no calculated dollar impact from ${impactBasisLabel(recommendation.financialImpact.basis)}`
  const prediction = recommendation.prediction
    ? `Based on ${recommendation.prediction.basis.historyWeeks} weeks of transactions, ${recommendation.prediction.outcome === 'unlikely-to-sell' ? `the recent pattern suggests ${recommendation.itemName} may not sell if reordered` : `the recent sales pattern may continue for ${recommendation.itemName}`}. This is drawn from the imported transaction history.`
    : 'Not provided. The available history earns an observation, not a prediction.'

  return [
    notice
      ? `Observation: ${notice} ${recommendation.itemName} has ${impactLead}; ${action} ${observationFacts(recommendation)}`
      : `Observation: ${recommendation.itemName} has ${impactLead}. ${action} ${observationFacts(recommendation)}`,
    `Financial impact: ${impact}`,
    `Prediction: ${prediction}`,
    `Recommendation: ${action}`,
    'Show your work: Ask to review the sources, calculations, and assumptions behind this recommendation.',
  ].join('\n')
}

/** Builds the fail-closed answer directly from deterministic MET-09 records. */
export function formatFivePartAnswer(
  recommendations: readonly RecommendationRecord[],
  notice = '',
) {
  const first = recommendations[0]
  if (!first) {
    return [
      `Observation: ${notice ? `${notice} ` : ''}The latest completed analysis has no ranked recommendation.`,
      'Financial impact: No dollar impact is available from the current data. Consider importing more records to review this location.',
      'Prediction: Not provided. There is no recommendation record to support a forward-looking statement.',
      'Recommendation: Consider importing more sales, purchasing, or inventory data this week.',
      'Show your work: Ask to review the sources, calculations, and assumptions used by the latest analysis.',
    ].join('\n')
  }
  return recommendationAnswer(first, notice)
}

/** Builds the deterministic response for a question outside the grounding boundary. */
export function formatDeclineAnswer(
  alternative: string,
  notice = '',
  scopeLabel = 'this location',
) {
  const dataScope =
    scopeLabel === 'this location'
      ? "from this location's imported data"
      : `from the imported data for ${scopeLabel}`
  return [
    `Observation: ${notice}${notice ? ' ' : ''}I can't answer that question ${dataScope}. Dollar impact is not available for it; consider asking, \"` +
      alternative +
      '\".',
    'Financial impact: Dollar impact is not available for the question asked.',
    'Prediction: Not provided. The imported data does not support a prediction for this question.',
    `Recommendation: Consider asking, "${alternative}"`,
    'Show your work: The question needs data or analysis that is outside this location’s imported records.',
  ].join('\n')
}
