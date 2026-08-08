import { describe, expect, it } from 'vitest'
import { OperationalMetrics } from './metrics'

describe('operational metrics', () => {
  it('alerts on failures and reports a location as stale after the threshold', () => {
    const alerts: unknown[] = []
    const metrics = new OperationalMetrics({
      onPrecomputeFailure: (alert) => alerts.push(alert),
    })
    const successAt = new Date('2026-08-08T10:00:00.000Z')
    const failureAt = new Date('2026-08-08T11:00:00.000Z')

    metrics.recordPrecomputeSuccess({
      locationId: 'location-1',
      runId: 'run-1',
      completedAt: successAt,
      durationMs: 1250,
    })
    metrics.recordPrecomputeFailure({
      locationId: 'location-1',
      runId: 'run-2',
      failedAt: failureAt,
    })

    expect(alerts).toEqual([
      {
        locationId: 'location-1',
        runId: 'run-2',
        failedAt: failureAt,
        failureCount: 1,
      },
    ])
    expect(
      metrics.getPrecomputeHealth(
        'location-1',
        new Date('2026-08-08T12:01:00.000Z'),
        2 * 60 * 60 * 1000,
      ),
    ).toEqual({
      locationId: 'location-1',
      lastSuccessfulAt: successAt,
      lastRunDurationMs: 1250,
      lastFailureAt: failureAt,
      failureCount: 1,
      isStale: true,
    })
  })

  it('keeps a successful run current and does not expose mutable dates', () => {
    const metrics = new OperationalMetrics()
    const completedAt = new Date('2026-08-08T10:00:00.000Z')

    metrics.recordPrecomputeSuccess({
      locationId: 'location-1',
      runId: 'run-1',
      completedAt,
      durationMs: 1.5,
    })
    completedAt.setUTCFullYear(2030)

    const health = metrics.getPrecomputeHealth(
      'location-1',
      new Date('2026-08-08T10:30:00.000Z'),
      60 * 60 * 1000,
    )
    expect(health.lastSuccessfulAt).toEqual(
      new Date('2026-08-08T10:00:00.000Z'),
    )
    expect(health.isStale).toBe(false)

    health.lastSuccessfulAt?.setUTCFullYear(2030)
    expect(
      metrics.getPrecomputeHealth(
        'location-1',
        new Date('2026-08-08T10:30:00.000Z'),
        60 * 60 * 1000,
      ).lastSuccessfulAt,
    ).toEqual(new Date('2026-08-08T10:00:00.000Z'))
  })

  it('aggregates LLM usage by account and UTC day with integer micro-costs', () => {
    const metrics = new OperationalMetrics()

    metrics.recordLlmQuery({
      accountId: 'account-1',
      completedAt: new Date('2026-08-08T23:59:00.000Z'),
      inputTokens: 3000,
      outputTokens: 500,
      costMicros: 3300,
      currency: 'USD',
    })
    metrics.recordLlmQuery({
      accountId: 'account-1',
      completedAt: new Date('2026-08-09T00:01:00.000Z'),
      inputTokens: 1000,
      outputTokens: 200,
      costMicros: 1100,
      currency: 'USD',
    })

    expect(metrics.getLlmDailySpend('account-1', '2026-08-08')).toEqual({
      accountId: 'account-1',
      day: '2026-08-08',
      queryCount: 1,
      inputTokens: 3000,
      outputTokens: 500,
      costMicros: 3300,
      currency: 'USD',
    })
    expect(metrics.listLlmDailySpend('account-1')).toMatchObject([
      { day: '2026-08-08', costMicros: 3300 },
      { day: '2026-08-09', costMicros: 1100 },
    ])
  })

  it('rejects unsafe numeric values and mixed currencies', () => {
    const metrics = new OperationalMetrics()
    const base = {
      accountId: 'account-1',
      completedAt: new Date('2026-08-08T12:00:00.000Z'),
      inputTokens: 1,
      outputTokens: 1,
      costMicros: 1,
      currency: 'USD',
    }

    expect(() => metrics.recordLlmQuery({ ...base, costMicros: 1.5 })).toThrow(
      'costMicros must be a non-negative safe integer',
    )
    metrics.recordLlmQuery(base)
    expect(() => metrics.recordLlmQuery({ ...base, currency: 'EUR' })).toThrow(
      'Cannot aggregate LLM spend across currencies',
    )
  })
})
