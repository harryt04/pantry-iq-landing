import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

import type { ChatMissReason } from './misses'

export type DeclineDetection = {
  detected: boolean
  reason: ChatMissReason
}

const DECLINE_MARKERS = [
  /\b(?:i|we) (?:can't|cannot|can not|am unable to|are unable to|am not able to|are not able to|['’]m unable to|['’]re unable to) (?:answer|determine|calculate|tell|show|say)\b/i,
  /\b(?:the )?(?:imported|available|current) data (?:does not|doesn't|cannot|can't|can not) (?:include|answer|support|show)\b/i,
  /\b(?:not enough|do not have enough|don't have enough|missing|no) (?:data|information|history|transaction history)\b/i,
  /\b(?:i|we) (?:don't|do not) have (?:the )?(?:data|information) (?:to|needed to)\b/i,
  /\boutside (?:the|this) (?:available )?(?:data|analysis|scope)\b/i,
]

const MISSING_DATA_MARKER =
  /\b(?:not enough|do not have enough|don't have enough|missing|no) (?:data|information|history|transaction history)\b/i

export function detectDecline(text: string): DeclineDetection {
  if (!DECLINE_MARKERS.some((marker) => marker.test(text))) {
    return { detected: false, reason: 'outside-grounding' }
  }

  return {
    detected: true,
    reason: MISSING_DATA_MARKER.test(text)
      ? 'missing-data'
      : 'outside-grounding',
  }
}

export function declineAlternative(
  recommendations: readonly RecommendationRecord[],
) {
  return recommendations.length > 0
    ? 'Which item should I review for current spoilage risk?'
    : 'Which sales, purchasing, or inventory patterns are visible in this location?'
}
