import { describe, expect, it } from 'vitest'

import { detectDecline } from './decline'

describe('chat decline detection', () => {
  it('recognizes missing-data language as a miss', () => {
    expect(
      detectDecline(
        "I don't have enough information to determine whether supplier pricing changed.",
      ),
    ).toEqual({ detected: true, reason: 'missing-data' })
  })

  it('does not classify a grounded answer as a miss', () => {
    expect(
      detectDecline(
        'Observation: Salmon has current spoilage risk. Consider reviewing it.',
      ),
    ).toEqual({ detected: false, reason: 'outside-grounding' })
  })
})
