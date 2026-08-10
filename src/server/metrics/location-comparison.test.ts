import { describe, expect, it } from 'vitest'

import {
  buildLocationComparison,
  spoilageRateFromTotals,
  type LocationComparisonInput,
} from './location-comparison'

const period = {
  start: '2026-07-01T00:00:00.000Z',
  end: '2026-08-01T00:00:00.000Z',
}

function location(
  locationId: string,
  locationName: string,
  dataSufficiency: string | null,
  overrides: Partial<LocationComparisonInput['metrics']> = {},
  locationPeriod = period,
): LocationComparisonInput {
  return {
    locationId,
    locationName,
    period: locationPeriod,
    dataSufficiency: {
      status: dataSufficiency === null ? 'cannot-calculate' : 'calculated',
      value: dataSufficiency,
    },
    metrics: {
      spoilageRate: '25',
      margin: '84.125',
      sellThrough: '75',
      moneyAtRisk: '12.50',
      ...overrides,
    },
  }
}

describe('location comparison', () => {
  it('calculates an exact spoilage rate without floating point arithmetic', () => {
    expect(spoilageRateFromTotals('3', '8')).toBe('37.5')
    expect(spoilageRateFromTotals('-3', '8')).toBe('0')
    expect(spoilageRateFromTotals('3', '0')).toBeNull()
  })

  it('marks uneven data sufficiency while keeping each score visible', () => {
    const result = buildLocationComparison([
      location('north', 'North', '90'),
      location('south', 'South', '65'),
    ])

    expect(result.status).toBe('ready')
    expect(result.coverage).toBe('varied')
    expect(
      result.locations.map(({ dataSufficiencyLabel }) => dataSufficiencyLabel),
    ).toEqual(['Data sufficiency 90/100', 'Data sufficiency 65/100'])
    expect(result.metrics[0]?.locations[0]).toMatchObject({
      value: '25',
      chartValue: 25,
      valueLabel: '25%',
    })
  })

  it('suppresses all comparison metrics when run periods differ', () => {
    const result = buildLocationComparison([
      location('north', 'North', '90'),
      location(
        'south',
        'South',
        '90',
        {},
        {
          start: '2026-07-02T00:00:00.000Z',
          end: '2026-08-02T00:00:00.000Z',
        },
      ),
    ])

    expect(result.status).toBe('period-mismatch')
    expect(result.metrics).toEqual([])
    expect(result.periodMismatchLocations).toEqual(['South'])
  })
})
