import { describe, expect, it } from 'vitest'

import {
  evaluateExternalSignals,
  measureExternalSignalCorrelations,
  type ExternalSignalInput,
} from './external-signals'

function signal(
  date: string,
  value: string,
  condition: string,
): ExternalSignalInput {
  const timestamp = new Date(`${date}T12:00:00.000Z`)
  return {
    id: `signal-${date}`,
    kind: 'weather',
    source: 'test-weather',
    externalId: `weather-${date}`,
    businessDate: date,
    status: 'observed',
    feature: 'rain',
    condition,
    value,
    retrievedAt: timestamp,
    validFrom: timestamp,
    validTo: new Date(`${date}T23:59:59.000Z`),
  }
}

describe('external staffing signals', () => {
  it('requires enough paired, varying dates and records the reason', () => {
    const dates = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 0, index + 1))
        .toISOString()
        .slice(0, 10)
      return date
    })
    const signals = dates.map((date) => signal(date, '1', 'rain'))
    const correlations = measureExternalSignalCorrelations(
      signals,
      dates.map((businessDate, index) => ({
        businessDate,
        sales: String(index + 1),
      })),
    )

    expect(correlations[0]).toMatchObject({
      observations: 20,
      coefficient: null,
      qualified: false,
    })
    expect(correlations[0]?.reason).toContain('do not vary enough')
  })

  it('qualifies a demonstrated source and preserves source provenance', () => {
    const dates = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 0, index + 1))
        .toISOString()
        .slice(0, 10)
      return date
    })
    const signals = dates.map((date, index) =>
      signal(
        date,
        index % 2 === 0 ? '1' : '0',
        index % 2 === 0 ? 'rain' : 'clear',
      ),
    )
    const result = evaluateExternalSignals(
      signals,
      dates.map((businessDate, index) => ({
        businessDate,
        sales: index % 2 === 0 ? '100' : '10',
      })),
    )

    expect(result.status).toBe('applied')
    expect(result.appliedCount).toBe(1)
    expect(result.sources).toMatchObject([
      { source: 'test-weather', rowCount: 20 },
    ])
    expect(result.traceCalculations[0]).toMatchObject({
      id: 'external-signal:correlation:weather:test-weather:rain',
    })
  })
})
