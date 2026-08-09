import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL =
    'postgres://dashboard-state-test:dashboard-state-test@localhost:5433/dashboard-state-test'
})

import { buildDashboardDataState } from './dashboard-state'

describe('dashboard data state', () => {
  it('treats duplicate rows and pre-boundary sales as one business day', () => {
    const state = buildDashboardDataState(
      [
        '2026-08-01T03:15:00.000Z',
        '2026-08-01T03:45:00.000Z',
        '2026-08-01T04:00:00.000Z',
      ],
      3,
      { boundary: '04:00:00' },
    )

    expect(state).toEqual({
      status: 'insufficient',
      transactionDays: 2,
      requiredDays: 3,
      remainingDays: 1,
    })
  })

  it.each([
    [[], 'empty', 0, 7],
    [['2026-08-01T12:00:00.000Z'], 'insufficient', 1, 6],
    [
      [
        '2026-08-01T12:00:00.000Z',
        '2026-08-02T12:00:00.000Z',
        '2026-08-03T12:00:00.000Z',
        '2026-08-04T12:00:00.000Z',
        '2026-08-05T12:00:00.000Z',
        '2026-08-06T12:00:00.000Z',
        '2026-08-07T12:00:00.000Z',
      ],
      'ready',
      7,
      0,
    ],
  ] as const)('reports %s coverage as %s', (dates, status, days, remaining) => {
    expect(buildDashboardDataState(dates)).toMatchObject({
      status,
      transactionDays: days,
      requiredDays: 7,
      remainingDays: remaining,
    })
  })

  it('ignores timestamps that cannot be assigned to a business day', () => {
    expect(buildDashboardDataState(['not-a-timestamp'])).toMatchObject({
      status: 'empty',
      transactionDays: 0,
      remainingDays: 7,
    })
  })
})
