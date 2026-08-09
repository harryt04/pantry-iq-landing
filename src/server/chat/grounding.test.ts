import { describe, expect, it } from 'vitest'

import { checkGrounding, checkRequiredLocationNames } from './grounding'

describe('chat grounding checks', () => {
  const context = {
    recommendation: { financialImpact: { amount: '1250.00' } },
    observation: { quantitySold: '2', sellThroughRate: '0.25' },
  }

  it('accepts supplied values with safe display formatting', () => {
    expect(
      checkGrounding('The impact is $1,250.00 and sell-through is 25%.', [
        context,
        { percentage: '25' },
      ]),
    ).toEqual({ accepted: true, unmatchedNumbers: [] })
  })

  it('rejects a figure absent from the supplied context', () => {
    expect(checkGrounding('The impact is $9,999.', [context])).toEqual({
      accepted: false,
      unmatchedNumbers: ['9999'],
    })
  })

  it('does not treat numeric fragments inside imported names as figures', () => {
    expect(
      checkGrounding('Watch the item named Table 12 Special.', [
        { itemName: 'Table 12 Special' },
      ]),
    ).toEqual({ accepted: true, unmatchedNumbers: [] })
  })

  it('requires every portfolio location name in the final answer', () => {
    expect(
      checkRequiredLocationNames(
        'The current pattern is shared by Downtown and Riverside.',
        ['Downtown', 'Riverside'],
      ),
    ).toEqual({ accepted: true, missingLocationNames: [] })
    expect(
      checkRequiredLocationNames('The current pattern is shared by Downtown.', [
        'Downtown',
        'Riverside',
      ]),
    ).toEqual({ accepted: false, missingLocationNames: ['Riverside'] })
  })
})
