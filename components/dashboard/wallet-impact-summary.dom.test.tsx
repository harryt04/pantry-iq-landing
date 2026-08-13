import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WalletImpactSummary } from './wallet-impact-summary'
import type { WalletImpactSummary as WalletSummary } from '@/src/server/metrics/wallet'

function summary(overrides: Partial<WalletSummary> = {}): WalletSummary {
  return {
    estimatedSpoilageThisWeek: { status: 'calculated', amount: '40.00' },
    moneyAtRisk: { status: 'calculated', amount: '55.625' },
    marginTrend: {
      currentValue: '90.125',
      currentValueLabel: '$90.125',
      direction: 'up',
      directionLabel: 'Up',
      comparisonLabel: 'Compared with last week.',
    },
    computedAt: '2026-08-08T12:00:00.000Z',
    ...overrides,
  }
}

describe('wallet impact summary', () => {
  it('keeps the calculated wallet amount as the lead figure', () => {
    const { container } = render(<WalletImpactSummary summary={summary()} />)

    expect(
      container.querySelector('.wallet-impact-card__lead'),
    ).toHaveTextContent('$55.625')
    expect(
      container.querySelectorAll('.wallet-impact-card .figure'),
    ).toHaveLength(3)
  })

  it('uses explanatory notes instead of mono placeholders when values are unavailable', () => {
    const { container } = render(
      <WalletImpactSummary
        summary={summary({
          estimatedSpoilageThisWeek: {
            status: 'cannot-calculate',
            amount: null,
            reason:
              'I need on-hand quantity and unit cost to estimate spoilage.',
          },
          moneyAtRisk: {
            status: 'cannot-calculate',
            amount: null,
            reason:
              'I need unit costs before I can show a dollar amount at risk.',
          },
          marginTrend: {
            currentValue: null,
            currentValueLabel: 'Not enough data',
            direction: 'unknown',
            directionLabel: 'No comparison',
            comparisonLabel: 'Margin needs more imported data.',
          },
        })}
      />,
    )

    expect(container.querySelector('.wallet-impact-card__lead')).toBeNull()
    expect(
      container.querySelectorAll('.wallet-impact-card .figure'),
    ).toHaveLength(0)
    expect(container.textContent).toContain(
      'I need unit costs before I can show a dollar amount at risk.',
    )
  })
})
