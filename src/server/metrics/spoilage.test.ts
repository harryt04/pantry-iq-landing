import { describe, expect, it } from 'vitest'

import { resolveSpoilage } from './spoilage'

const date = (value: string) => new Date(`${value}T12:00:00.000Z`)

describe('spoilage resolution', () => {
  it('uses successive physical counts and retains a material inferred variance', () => {
    const result = resolveSpoilage({
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-08'),
      orders: [{ qty: '10', orderedAt: date('2026-08-03') }],
      sales: [{ qty: '2', transactedAt: date('2026-08-05') }],
      snapshots: [
        { qty: '3', countedAt: date('2026-08-01') },
        { qty: '4', countedAt: date('2026-08-08') },
      ],
    })

    expect(result.metric).toMatchObject({ status: 'calculated', value: '7' })
    expect(result.resolution).toMatchObject({
      method: 'snapshot',
      fallbackWindowDays: 7,
      figures: [
        {
          method: 'snapshot',
          value: '7',
          inferredValue: '4',
          inputs: {
            beginningOnHand: '3',
            ordered: '10',
            sold: '2',
            endingOnHand: '4',
          },
        },
      ],
      variances: [
        {
          snapshotValue: '7',
          inferredValue: '4',
          difference: '3',
          thresholdPercent: '20',
        },
      ],
    })
  })

  it('falls back to ordered minus sold minus on-hand when no counts exist', () => {
    const result = resolveSpoilage({
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-08'),
      orders: [{ qty: '10', orderedAt: date('2026-08-03') }],
      sales: [{ qty: '2', transactedAt: date('2026-08-05') }],
      snapshots: [],
      qtyOnHand: '4',
      onHandAt: date('2026-08-07'),
    })

    expect(result.metric).toMatchObject({ status: 'calculated', value: '4' })
    expect(result.resolution.figures[0]).toMatchObject({ method: 'inferred' })
  })

  it('does not treat a snapshot older than the fallback window as current', () => {
    const result = resolveSpoilage({
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-10'),
      orders: [{ qty: '10', orderedAt: date('2026-08-05') }],
      sales: [{ qty: '2', transactedAt: date('2026-08-06') }],
      snapshots: [{ qty: '4', countedAt: date('2026-08-01') }],
    })

    expect(result.metric).toMatchObject({
      status: 'cannot-calculate',
      reason: 'cannot calculate, no complete spoilage inputs',
    })
    expect(result.resolution.figures).toEqual([])
  })

  it('does not turn missing snapshots and on-hand data into zero spoilage', () => {
    const result = resolveSpoilage({
      periodStart: date('2026-08-01'),
      periodEnd: date('2026-08-08'),
      orders: [],
      sales: [],
      snapshots: [],
    })

    expect(result.metric.status).toBe('cannot-calculate')
    expect(result.metric).not.toHaveProperty('value', '0')
  })
})
