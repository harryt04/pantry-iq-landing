import { describe, expect, it } from 'vitest'

import {
  businessDayBucket,
  margin,
  sellThroughRate,
  spoilageEstimate,
  spoilageRisk,
  variance,
} from './definitions'

describe('derived metric definitions', () => {
  it('reproduces the worked salmon figures without floating point arithmetic', () => {
    expect(
      sellThroughRate({ qtySold: '0', qtyOrdered: '2', unit: 'lb' }),
    ).toMatchObject({ status: 'calculated', value: '0', units: { value: '%' } })
    expect(
      spoilageRisk({
        qtyOnHand: '2',
        unitCost: '20.00',
        unit: 'lb',
        currency: 'USD',
      }),
    ).toMatchObject({
      status: 'calculated',
      value: '40',
      units: { value: 'USD' },
    })
  })

  it('calculates exact quantity and money metrics from decimal strings', () => {
    expect(
      spoilageEstimate({
        qtyOrdered: '12.50',
        qtySold: '3.25',
        qtyOnHand: '2.00',
        unit: 'lb',
      }),
    ).toMatchObject({ status: 'calculated', value: '7.25' })
    expect(
      margin({
        revenue: '123.45',
        qtySold: '3.25',
        unitCost: '12.10',
        unit: 'lb',
        currency: 'USD',
      }),
    ).toMatchObject({ status: 'calculated', value: '84.125' })
    expect(
      variance({
        qtyOrdered: '12.50',
        qtySold: '3.25',
        qtyOnHand: '2.00',
        unit: 'lb',
      }),
    ).toMatchObject({ status: 'calculated', value: '58' })
  })

  it('returns an explicit cannot-calculate result for missing dependencies', () => {
    expect(spoilageRisk({ qtyOnHand: '2' })).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, no unit cost',
    })
    expect(margin({ revenue: '20', qtySold: '2' })).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, no unit cost',
    })
    expect(sellThroughRate({ qtySold: '1', qtyOrdered: '0' })).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, quantity ordered is zero',
    })
  })

  it('rejects malformed decimal strings instead of calculating with them', () => {
    expect(
      margin({ revenue: '20', qtySold: '2', unitCost: 'not-a-number' }),
    ).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, unitCost is not a valid decimal',
    })
  })

  it('buckets timestamps by the location business day across midnight and DST', () => {
    expect(
      businessDayBucket({
        timestamp: '2026-01-10T11:15:00.000Z',
        timezone: 'America/Denver',
        boundary: '04:00:00',
      }),
    ).toMatchObject({ status: 'calculated', value: '2026-01-10' })
    expect(
      businessDayBucket({
        timestamp: '2026-01-10T10:15:00.000Z',
        timezone: 'America/Denver',
        boundary: '04:00:00',
      }),
    ).toMatchObject({ status: 'calculated', value: '2026-01-09' })
    expect(
      businessDayBucket({
        timestamp: '2026-03-08T11:30:00.000Z',
        timezone: 'America/Denver',
        boundary: '04:00:00',
      }),
    ).toMatchObject({ status: 'calculated', value: '2026-03-08' })
  })

  it('rejects invalid dates, timezones, and business-day boundaries explicitly', () => {
    expect(
      businessDayBucket({
        timestamp: 'not-a-date',
        timezone: 'America/Denver',
      }),
    ).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, timestamp is invalid',
    })
    expect(
      businessDayBucket({
        timestamp: new Date('not-a-date'),
        timezone: 'America/Denver',
      }),
    ).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, timestamp is invalid',
    })
    expect(
      businessDayBucket({
        timestamp: '2026-01-10T10:00:00.000Z',
        timezone: 'not-a-timezone',
      }),
    ).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, timezone is invalid',
    })
    expect(
      businessDayBucket({
        timestamp: '2026-01-10T10:00:00.000Z',
        timezone: 'America/Denver',
        boundary: '25:00',
      }),
    ).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, business-day boundary is invalid',
    })
  })
})
