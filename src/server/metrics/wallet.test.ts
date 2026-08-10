import { describe, expect, it } from 'vitest'

import { buildWalletImpactSummary } from './wallet'

const margin = {
  currentValue: '90.125',
  currentValueLabel: '$90.125',
  direction: 'up' as const,
  directionLabel: 'Up',
  comparisonLabel: 'Compared with the week of Jul 6–Jul 12.',
}

describe('dashboard wallet impact summary', () => {
  it('keeps exact dollar contributions and puts current spoilage first', () => {
    const summary = buildWalletImpactSummary({
      impact: {
        dollarsAvailable: true,
        categories: {
          currentSpoilage: {
            status: 'calculated',
            value: '40.00',
            scoreBasis: 'dollars',
          },
          historicalSpoilage: {
            status: 'calculated',
            value: '10.125',
            scoreBasis: 'dollars',
          },
          overordering: {
            status: 'calculated',
            value: '5.50',
            scoreBasis: 'dollars',
          },
          marginLoss: {
            status: 'calculated',
            value: '0',
            scoreBasis: 'dollars',
          },
        },
      },
      margin,
      computedAt: new Date('2026-08-08T12:00:00.000Z'),
    })

    expect(summary).toMatchObject({
      estimatedSpoilageThisWeek: { status: 'calculated', amount: '40.00' },
      moneyAtRisk: { status: 'calculated', amount: '55.625' },
      marginTrend: margin,
      computedAt: '2026-08-08T12:00:00.000Z',
    })
  })

  it('does not invent dollars when impact has only unit signals', () => {
    const summary = buildWalletImpactSummary({
      impact: {
        dollarsAvailable: false,
        dollarReason: 'dollars cannot be calculated from the available data',
        categories: {
          currentSpoilage: {
            status: 'calculated',
            value: null,
            scoreBasis: 'units',
            unitSignal: '2',
          },
        },
      },
      margin: undefined,
      computedAt: null,
    })

    expect(summary.estimatedSpoilageThisWeek).toMatchObject({
      status: 'cannot-calculate',
      amount: null,
    })
    expect(summary.moneyAtRisk).toMatchObject({
      status: 'cannot-calculate',
      amount: null,
      reason: 'dollars cannot be calculated from the available data',
    })
  })

  it('keeps the dashboard honest while a run is not available', () => {
    const summary = buildWalletImpactSummary({
      impact: null,
      margin: undefined,
      computedAt: null,
    })

    expect(summary.estimatedSpoilageThisWeek.reason).toContain(
      'until a metric run finishes',
    )
    expect(summary.computedAt).toBeNull()
  })
})
