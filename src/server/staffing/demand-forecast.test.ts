import { describe, expect, it } from 'vitest'

import { buildDemandForecast } from './demand-forecast'
import type { ExternalSignalInput } from './external-signals'

function dateAt(day: string, hour: number) {
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`)
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function salesForDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const day = addDays('2025-01-01', index)
    return {
      transactedAt: dateAt(day, 10),
      qty: String(index + 1),
      revenue: String((index + 1) * 10),
    }
  })
}

describe('demand forecasting', () => {
  it('suppresses predictions until four weeks of distinct business days exist', () => {
    const result = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales: salesForDays(27),
      asOf: dateAt('2025-02-01', 12),
    })

    expect(result.status).toBe('suppressed')
    expect(result.historyDays).toBe(27)
    expect(result.reason).toContain('28 distinct business days')
    expect(result.trace.calculations).toHaveLength(1)
    expect(result.trace.calculations[0]).toMatchObject({
      id: 'forecast:accuracy',
    })
  })

  it('uses exact same-weekday and day-part history with an explainable trace', () => {
    const result = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales: salesForDays(35),
      asOf: dateAt('2025-02-05', 12),
    })

    expect(result.status).toBe('calculated')
    expect(result.periods).toHaveLength(28)
    const first = result.periods.find((period) => period.dayPart === 'Morning')
    expect(first).toMatchObject({
      referencePeriods: 5,
      covers: { status: 'calculated' },
      sales: { status: 'calculated' },
    })
    expect(first?.basis).toContain(first?.dayOfWeek)
    expect(result.trace.assumptions[0]?.value).toContain('same-weekday')
    expect(result.trace.calculations[0]).toMatchObject({
      operator: 'mean of the latest same-weekday, same-day-part periods',
      units: { covers: 'imported transaction quantity', sales: 'currency' },
    })
    expect(result.accuracy.status).toBe('calculated')
    expect(result.accuracy.observations).toBeGreaterThan(0)
  })

  it('applies the restaurant business-day boundary before grouping', () => {
    const result = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales: [
        {
          transactedAt: dateAt('2025-01-01', 3),
          qty: '2',
          revenue: '20',
        },
      ],
      asOf: dateAt('2025-01-02', 12),
    })

    expect(result.historyDays).toBe(1)
    expect(result.trace.sources[0]?.rowCount).toBe(1)
  })

  it('never invents a prediction for a day part without comparable history', () => {
    const result = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales: salesForDays(35),
      asOf: dateAt('2025-02-05', 12),
    })

    const overnight = result.periods.find(
      (period) => period.dayPart === 'Overnight',
    )
    expect(overnight).toMatchObject({
      referencePeriods: 0,
      covers: { status: 'cannot-calculate', value: null },
      sales: { status: 'cannot-calculate', value: null },
    })
  })

  it('uses a demonstrated external condition to choose comparable history', () => {
    const sales = Array.from({ length: 35 }, (_, index) => {
      const day = addDays('2025-01-01', index)
      const condition = Math.floor(index / 7) % 2 === 1
      return {
        transactedAt: dateAt(day, 10),
        qty: condition ? '10' : '1',
        revenue: condition ? '100' : '10',
      }
    })
    const externalSignals: ExternalSignalInput[] = Array.from(
      { length: 42 },
      (_, index) => {
        const businessDate = addDays('2025-01-01', index)
        const condition = Math.floor(index / 7) % 2 === 1
        const timestamp = dateAt(businessDate, 12)
        return {
          id: `weather-${businessDate}`,
          kind: 'weather',
          source: 'test-weather',
          externalId: `weather-${businessDate}`,
          businessDate,
          status: index < 35 ? 'observed' : 'forecast',
          feature: 'rain',
          condition: condition ? 'rain' : 'clear',
          value: condition ? '1' : '0',
          retrievedAt: timestamp,
          validFrom: timestamp,
          validTo: new Date(`${businessDate}T23:59:59.000Z`),
        }
      },
    )

    const result = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales,
      externalSignals,
      asOf: dateAt('2025-02-05', 12),
    })
    const firstForecast = result.periods.find(
      (period) =>
        period.businessDate === '2025-02-06' && period.dayPart === 'Morning',
    )

    expect(result.externalSignals.status).toBe('applied')
    expect(firstForecast?.basis).toContain(
      'demonstrated external-signal condition',
    )
    expect(firstForecast?.sales.value).toBe('100')
    expect(result.trace.sources).toContainEqual(
      expect.objectContaining({ source: 'test-weather', rowCount: 42 }),
    )
  })
})
