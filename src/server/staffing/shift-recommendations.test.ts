import { describe, expect, it } from 'vitest'

import { buildDemandForecast } from './demand-forecast'
import { buildShiftRecommendations } from './shift-recommendations'

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

describe('shift-level recommendations', () => {
  it('turns forecast sales and role productivity into ranked suggestions', () => {
    const sales = Array.from({ length: 35 }, (_, index) => {
      const day = addDays('2025-01-01', index)
      return {
        transactedAt: new Date(`${day}T10:00:00.000Z`),
        qty: String(index + 1),
        revenue: String((index + 1) * 10),
      }
    })
    const forecast = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales,
      asOf: new Date('2025-02-05T12:00:00.000Z'),
    })
    const labor = sales.map((sale, index) => ({
      id: `shift-${index}`,
      shiftStart: sale.transactedAt,
      shiftEnd: new Date(sale.transactedAt.getTime() + 2 * 60 * 60 * 1000),
      role: 'Line cook',
      scheduledHours: '2',
      actualHours: '2',
      laborCost: '40',
    }))

    const recommendations = buildShiftRecommendations({
      forecast,
      sales,
      labor,
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      asOf: new Date('2025-02-05T12:00:00.000Z'),
    })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(
      recommendations.map((recommendation) => recommendation.rank),
    ).toEqual(recommendations.map((_, index) => index + 1))
    expect(recommendations[0]).toMatchObject({
      version: 1,
      role: 'Line cook',
      suggestedAction: { framing: 'consider', action: 'schedule-hours' },
      uncertainty: { status: 'calculated' },
      historicalSalesPerLaborHour: expect.any(String),
      evidenceTraceRef: { role: 'Line cook' },
    })
    expect(recommendations[0]?.evidenceTrace.calculations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'metric:staffingForecast' }),
        expect.objectContaining({ id: 'metric:staffingProductivity' }),
        expect.objectContaining({ id: 'ranking:score' }),
      ]),
    )
    expect(recommendations[0]?.risks).toEqual({
      understaffing: expect.objectContaining({ status: 'not-indicated' }),
      overstaffing: expect.objectContaining({ status: 'not-indicated' }),
    })
  })

  it('keeps the point suggestion visible while saying when the error range is unknown', () => {
    const sales = Array.from({ length: 35 }, (_, index) => ({
      transactedAt: new Date(`${addDays('2025-01-01', index)}T10:00:00.000Z`),
      qty: '1',
      revenue: String(10 + index),
    }))
    const forecast = buildDemandForecast({
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      sales,
      asOf: new Date('2025-02-05T12:00:00.000Z'),
    })
    const labor = sales.map((sale, index) => ({
      id: `shift-${index}`,
      shiftStart: sale.transactedAt,
      shiftEnd: new Date(sale.transactedAt.getTime() + 2 * 60 * 60 * 1000),
      role: 'Server',
      scheduledHours: '2',
      actualHours: '2',
      laborCost: '30',
    }))
    const recommendations = buildShiftRecommendations({
      forecast: {
        ...forecast,
        accuracy: { ...forecast.accuracy, salesMae: null },
      },
      sales,
      labor,
      timezone: 'UTC',
      businessDayBoundary: '04:00',
      asOf: new Date('2025-02-05T12:00:00.000Z'),
    })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations[0]).toMatchObject({
      uncertainty: { status: 'cannot-calculate', lowerHours: null },
      risks: {
        understaffing: { status: 'cannot-calculate' },
        overstaffing: { status: 'cannot-calculate' },
      },
    })
  })
})
