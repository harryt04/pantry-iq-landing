import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL =
    'postgres://trend-test:trend-test@localhost:5433/trend-test'
})

import { buildTrendSummaries } from './trends'

describe('dashboard trend summaries', () => {
  it('keeps exact values, names the comparison week, and reports direction', () => {
    const summaries = buildTrendSummaries([
      {
        label: 'Jul 6–Jul 12',
        margin: '84.125',
        spoilage: '7.25',
        sellThrough: '72.5',
        unit: 'lb',
      },
      {
        label: 'Jul 13–Jul 19',
        margin: '90.125',
        spoilage: '5.25',
        sellThrough: '80',
        unit: 'lb',
      },
    ])

    expect(summaries).toMatchObject([
      {
        id: 'margin',
        currentValue: '90.125',
        currentValueLabel: '$90.125',
        direction: 'up',
        comparisonLabel: 'Compared with the week of Jul 6–Jul 12.',
      },
      { id: 'spoilage', currentValue: '5.25', direction: 'down' },
      {
        id: 'sellThrough',
        currentValue: '80',
        currentValueLabel: '80%',
        direction: 'up',
      },
    ])
  })

  it('preserves unsupported periods as chart gaps instead of interpolating', () => {
    const [margin] = buildTrendSummaries([
      { label: 'Jul 6–Jul 12', margin: '84' },
      { label: 'Jul 13–Jul 19' },
      { label: 'Jul 20–Jul 26', margin: '90' },
    ])

    expect(margin?.points).toEqual([
      { label: 'Jul 6–Jul 12', value: '84', chartValue: 84, valueLabel: '$84' },
      {
        label: 'Jul 13–Jul 19',
        value: null,
        chartValue: null,
        valueLabel: 'No data',
      },
      {
        label: 'Jul 20–Jul 26',
        value: '90',
        chartValue: 90,
        valueLabel: '$90',
      },
    ])
    expect(margin?.comparisonLabel).toBe(
      'Compared with the week of Jul 6–Jul 12.',
    )
  })

  it('does not invent a comparison when only one period is calculable', () => {
    const [margin] = buildTrendSummaries([
      { label: 'Jul 20–Jul 26', margin: '90' },
    ])

    expect(margin).toMatchObject({
      currentValue: '90',
      direction: 'unknown',
      directionLabel: 'No comparison',
      comparisonLabel: 'No previous week has enough data for comparison.',
    })
  })
})
