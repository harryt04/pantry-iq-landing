import { describe, expect, it } from 'vitest'

import { buildLaborEfficiencyMetrics } from './labor-efficiency'

const labor = [
  {
    id: 'shift-1',
    shiftStart: '2026-08-10T10:00:00.000Z',
    shiftEnd: '2026-08-10T18:00:00.000Z',
    role: 'line cook',
    scheduledHours: '10',
    actualHours: '8',
    laborCost: '20',
  },
]

describe('labor efficiency metrics', () => {
  it('aligns shift sales to an inclusive start and exclusive end', () => {
    const result = buildLaborEfficiencyMetrics({
      timezone: 'America/Denver',
      businessDayBoundary: '04:00:00',
      labor,
      sales: [
        {
          transactedAt: '2026-08-10T10:00:00.000Z',
          revenue: '100',
          totalCost: '30',
        },
        {
          transactedAt: '2026-08-10T17:00:00.000Z',
          revenue: '50',
          totalCost: '15',
        },
        {
          transactedAt: '2026-08-10T18:00:00.000Z',
          revenue: '25',
          totalCost: '8',
        },
      ],
    })

    const shift = result.periods.find((period) => period.dimension === 'shift')
    expect(shift).toMatchObject({
      label: 'line cook · 2026-08-10',
      sales: '150',
      foodCost: '45',
      scheduledHours: '10',
      actualHours: '8',
      laborCost: '20',
      scheduledActualVariance: '-2',
    })
    expect(shift?.salesPerLaborHour).toMatchObject({
      status: 'calculated',
      value: '18.75',
    })
    expect(shift?.laborCostPercentage).toMatchObject({
      status: 'calculated',
      value: '13.333333',
    })
    expect(shift?.primeCost).toMatchObject({
      status: 'calculated',
      value: '65',
    })
    expect(shift?.primeCostPercentage).toMatchObject({
      status: 'calculated',
      value: '43.333333',
    })
    expect(
      result.exclusions.some(
        (exclusion) =>
          exclusion.dimension === 'shift' &&
          exclusion.reason === 'Sale is outside every complete shift.',
      ),
    ).toBe(true)
  })

  it('groups by business-day day part and day of week without using calendar midnight', () => {
    const result = buildLaborEfficiencyMetrics({
      timezone: 'America/Denver',
      businessDayBoundary: '04:00:00',
      labor,
      sales: [
        {
          transactedAt: '2026-08-10T10:00:00.000Z',
          revenue: '100',
          totalCost: '30',
        },
      ],
    })

    expect(result.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'day-part', label: 'Morning' }),
        expect.objectContaining({ dimension: 'day-of-week', label: 'Monday' }),
      ]),
    )
    expect(
      result.exclusions.some(
        (exclusion) =>
          exclusion.dimension === 'input' &&
          exclusion.reason.includes('could not be assigned'),
      ),
    ).toBe(false)
  })

  it('does not invent prime cost when any food-cost row is incomplete', () => {
    const result = buildLaborEfficiencyMetrics({
      timezone: 'America/Denver',
      businessDayBoundary: '04:00:00',
      labor,
      sales: [
        {
          transactedAt: '2026-08-10T10:00:00.000Z',
          revenue: '100',
          totalCost: null,
        },
      ],
    })
    const shift = result.periods.find((period) => period.dimension === 'shift')
    expect(shift?.primeCost).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, no complete food cost',
    })
    expect(shift?.salesPerLaborHour).toMatchObject({
      status: 'calculated',
      value: '12.5',
    })
  })

  it('excludes labor-only and sales-only periods instead of treating the other side as zero', () => {
    const result = buildLaborEfficiencyMetrics({
      timezone: 'America/Denver',
      businessDayBoundary: '04:00:00',
      labor: [
        ...labor,
        {
          ...labor[0]!,
          id: 'shift-2',
          shiftStart: '2026-08-11T10:00:00.000Z',
          shiftEnd: '2026-08-11T18:00:00.000Z',
        },
      ],
      sales: [
        {
          transactedAt: '2026-08-10T10:00:00.000Z',
          revenue: '100',
          totalCost: '30',
        },
      ],
    })
    expect(
      result.exclusions.some(
        (exclusion) =>
          exclusion.dimension === 'day-of-week' &&
          exclusion.period === 'Tuesday' &&
          exclusion.reason === 'No sales data for this period.',
      ),
    ).toBe(true)
  })
})
