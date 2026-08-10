import { describe, expect, it } from 'vitest'

import { calculateUrgency } from './urgency'

const now = new Date('2026-08-08T12:00:00.000Z')

describe('urgency score', () => {
  it('keeps an unset shelf life below an identical item with a two-day shelf life', () => {
    const common = {
      freshnessAnchorAt: new Date('2026-08-08T12:00:00.000Z'),
      now,
      sales: [],
      orders: [],
    }

    const unset = calculateUrgency(common)
    const known = calculateUrgency({ ...common, shelfLifeDays: 2 })

    expect(unset.value).toBe('0')
    expect(known.value).toBe('38')
    expect(unset.components.shelfLife).toMatchObject({
      status: 'suppressed',
      score: '0',
    })
    expect(known.components.shelfLife).toMatchObject({
      status: 'calculated',
      score: '75',
      inputs: { shelfLifeDays: '2', remainingDays: '2' },
    })
  })

  it('suppresses trend acceleration until two comparable weeks exist', () => {
    const result = calculateUrgency({
      shelfLifeDays: 30,
      freshnessAnchorAt: now,
      now,
      sales: [{ qty: '2', transactedAt: new Date('2026-08-01T12:00:00.000Z') }],
    })

    expect(result.components.trendAcceleration).toMatchObject({
      status: 'suppressed',
      score: '0',
    })
    expect(result.components.trendAcceleration.reason).toContain(
      '2 weeks of history',
    )
  })

  it('scores acceleration from comparable seven-day quantities', () => {
    const result = calculateUrgency({
      shelfLifeDays: 30,
      freshnessAnchorAt: now,
      now,
      sales: [
        { qty: '2', transactedAt: new Date('2026-07-18T12:00:00.000Z') },
        { qty: '2', transactedAt: new Date('2026-07-24T12:00:00.000Z') },
        { qty: '4', transactedAt: new Date('2026-07-25T12:00:00.000Z') },
        { qty: '4', transactedAt: new Date('2026-08-01T12:00:00.000Z') },
      ],
    })

    expect(result.components.trendAcceleration).toMatchObject({
      status: 'calculated',
      score: '100',
      inputs: {
        priorQuantity: '4',
        recentQuantity: '8',
        accelerationPercent: '100',
      },
    })
  })

  it('derives supplier lead time from completed orders and exposes the input', () => {
    const result = calculateUrgency({
      shelfLifeDays: 30,
      freshnessAnchorAt: now,
      now,
      orders: [
        {
          orderedAt: new Date('2026-07-01T12:00:00.000Z'),
          receivedAt: new Date('2026-07-11T12:00:00.000Z'),
        },
        {
          orderedAt: new Date('2026-07-15T12:00:00.000Z'),
          receivedAt: new Date('2026-07-25T12:00:00.000Z'),
        },
      ],
    })

    expect(result.components.supplierLeadTime).toMatchObject({
      status: 'calculated',
      score: '75',
      inputs: { completedOrderCount: '2', averageLeadTimeDays: '10' },
    })
    expect(result.thresholds).toMatchObject({
      highUrgencyDays: 7,
      mediumUrgencyDays: 14,
    })
  })

  it('uses configured thresholds and weights without floating-point arithmetic', () => {
    const result = calculateUrgency(
      {
        shelfLifeDays: 2,
        freshnessAnchorAt: now,
        now,
      },
      {
        weights: { shelfLife: 100, trendAcceleration: 0, supplierLeadTime: 0 },
        highUrgencyDays: 3,
        mediumUrgencyDays: 5,
      },
    )

    expect(result.value).toBe('75')
    expect(result.inputs.weightTotal).toBe('100')
    expect(result.components.shelfLife.inputs.remainingDays).toBe('2')
  })
})
