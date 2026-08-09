import { describe, expect, it } from 'vitest'

import { buildPrecomputeResults } from './precompute'
import type { ReconciliationConflict } from '@/src/server/ingestion/reconciliation'
import {
  PRECOMPUTE_DAILY_CRON,
  PRECOMPUTE_QUEUE,
  PRECOMPUTE_TIME_BUDGET_MS,
  createPrecomputeScheduler,
} from './scheduler'

const now = new Date('2026-08-08T12:00:00.000Z')

const input = {
  items: [{ id: 'item-1', unit: 'lb', costPerUnit: null }],
  sales: [
    {
      itemId: 'item-1',
      qty: '3.00',
      revenue: '30.00',
      transactedAt: new Date('2026-08-01T12:00:00.000Z'),
    },
  ],
  orders: [
    {
      itemId: 'item-1',
      qty: '5.00',
      totalCost: '50.00',
      orderedAt: new Date('2026-07-31T12:00:00.000Z'),
    },
  ],
  snapshots: [
    {
      itemId: 'item-1',
      qty: '1.00',
      countedAt: new Date('2026-08-02T12:00:00.000Z'),
    },
  ],
} as const

describe('precompute results', () => {
  it('persists every MET-01 metric with exact evidence', () => {
    const output = buildPrecomputeResults(input, now)
    const metrics = output.itemResults[0]?.metrics

    expect(metrics).toHaveLength(8)
    expect(metrics?.map((metric) => metric.metricKey)).toEqual([
      'sellThrough',
      'spoilageEstimate',
      'spoilageRisk',
      'margin',
      'variance',
      'dataSufficiency',
      'impact',
      'urgency',
    ])
    expect(metrics?.map((metric) => metric.value)).toEqual([
      '60',
      '1',
      '10',
      '0',
      '20',
      '15',
      '11',
      '0',
    ])
    expect(metrics?.[0]?.result).toMatchObject({
      status: 'calculated',
      inputs: { qtySold: '3', qtyOrdered: '5' },
      units: { value: '%' },
    })
    expect(
      output.rollups.find((metric) => metric.metricKey === 'spoilageEstimate')
        ?.result,
    ).toMatchObject({
      inputs: { orderedQuantity: '5' },
    })
    expect(output.rollups.map((metric) => metric.value)).toEqual([
      '60',
      '1',
      '10',
      '0',
      '20',
      '15',
      '11',
      '0',
    ])
    expect(output.rankedItems).toMatchObject([
      {
        itemId: 'item-1',
        rank: 1,
        score: '7.4',
      },
    ])
  })

  it('is deterministic when the source rows and run time are unchanged', () => {
    expect(buildPrecomputeResults(input, now)).toEqual(
      buildPrecomputeResults(input, now),
    )
  })

  it('carries source authority decisions into recommendation evidence', () => {
    const conflict: ReconciliationConflict = {
      recordKind: 'inventory',
      conflictType: 'period-overlap',
      identityKey: 'inventory|period-overlap|2026-08-01',
      externalId: null,
      periodStart: new Date('2026-08-01T12:00:00.000Z'),
      periodEnd: new Date('2026-08-01T12:00:00.000Z'),
      sources: ['square', 'csv'],
      status: 'resolved',
      authoritySource: 'square',
      details: { message: 'Square is the authority for this count.' },
    }
    const output = buildPrecomputeResults(
      { ...input, reconciliation: [conflict] },
      now,
    )

    expect(output.recommendations[0]?.evidenceTrace?.reconciliation).toEqual([
      expect.objectContaining({
        conflictType: 'period-overlap',
        authoritySource: 'square',
        status: 'resolved',
      }),
    ])
  })

  it('keeps missing inputs explicit instead of turning them into zeroes', () => {
    const output = buildPrecomputeResults(
      {
        items: [{ id: 'item-1', unit: 'each', costPerUnit: null }],
        sales: [],
        orders: [],
        snapshots: [],
      },
      now,
    )

    expect(output.itemResults[0]?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'margin',
          status: 'cannot-calculate',
          value: null,
          result: expect.objectContaining({
            reason: 'cannot calculate, no revenue',
          }),
        }),
      ]),
    )
  })

  it('computes ratio rollups from totals instead of adding percentages', () => {
    const output = buildPrecomputeResults(
      {
        items: [
          { id: 'item-1', unit: 'each', costPerUnit: '1' },
          { id: 'item-2', unit: 'each', costPerUnit: '1' },
        ],
        sales: [
          {
            itemId: 'item-1',
            qty: '1',
            revenue: '2',
            transactedAt: new Date('2026-08-01T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '1',
            revenue: '2',
            transactedAt: new Date('2026-08-01T12:00:00.000Z'),
          },
        ],
        orders: [
          {
            itemId: 'item-1',
            qty: '2',
            totalCost: '2',
            orderedAt: new Date('2026-07-31T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '8',
            totalCost: '8',
            orderedAt: new Date('2026-07-31T12:00:00.000Z'),
          },
        ],
        snapshots: [
          {
            itemId: 'item-1',
            qty: '1',
            countedAt: new Date('2026-08-02T12:00:00.000Z'),
          },
          {
            itemId: 'item-2',
            qty: '7',
            countedAt: new Date('2026-08-02T12:00:00.000Z'),
          },
        ],
      },
      now,
    )

    expect(output.rollups[0]?.value).toBe('20')
  })

  it('keeps a one-year location run inside the documented budget', () => {
    const year = Array.from({ length: 365 }, (_, index) => {
      const day = new Date('2025-08-09T12:00:00.000Z')
      day.setUTCDate(day.getUTCDate() + index)
      return day
    })
    const startedAt = performance.now()
    const output = buildPrecomputeResults(
      {
        items: [{ id: 'item-1', unit: 'lb', costPerUnit: '2.50' }],
        sales: year.map((transactedAt) => ({
          itemId: 'item-1',
          qty: '3',
          revenue: '30',
          transactedAt,
        })),
        orders: year.map((orderedAt) => ({
          itemId: 'item-1',
          qty: '5',
          totalCost: '12.50',
          orderedAt,
        })),
        snapshots: year.map((countedAt) => ({
          itemId: 'item-1',
          qty: '1',
          countedAt,
        })),
      },
      now,
    )

    expect(output.itemResults).toHaveLength(1)
    expect(performance.now() - startedAt).toBeLessThan(
      PRECOMPUTE_TIME_BUDGET_MS,
    )
  })
})

describe('precompute scheduler', () => {
  it('initializes once and enqueues a location singleton', async () => {
    const calls: Array<{ name: string; data: unknown; options?: unknown }> = []
    const boss = {
      start: async () => undefined,
      stop: async () => undefined,
      createQueue: async () => undefined,
      send: async (name: string, data: unknown, options?: unknown) => {
        calls.push({ name, data, options })
        return 'job-1'
      },
      schedule: async () => undefined,
      work: async () => 'worker-1',
    } as unknown as Parameters<typeof createPrecomputeScheduler>[0]['boss']
    const scheduler = createPrecomputeScheduler({
      boss,
      listLocationIds: async () => [],
      run: async () => ({ id: 'run-1', completedAt: now }),
    })

    await scheduler.enqueueLocation('location-1')
    await scheduler.enqueueLocation('location-1')

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      name: PRECOMPUTE_QUEUE,
      data: { scope: 'location', locationId: 'location-1' },
      options: { singletonKey: 'location:location-1' },
    })
  })

  it('fans out the daily schedule and surfaces worker failures', async () => {
    const calls: Array<{ name: string; data: unknown; options?: unknown }> = []
    let handler:
      | ((jobs: Array<{ id: string; data: unknown }>) => Promise<void>)
      | undefined
    const errors: string[] = []
    const boss = {
      start: async () => undefined,
      stop: async () => undefined,
      createQueue: async () => undefined,
      send: async (name: string, data: unknown, options?: unknown) => {
        calls.push({ name, data, options })
        return 'job-1'
      },
      schedule: async (
        name: string,
        cron: string,
        data: unknown,
        options?: unknown,
      ) => {
        calls.push({ name, data: { cron, data }, options })
      },
      work: async (
        _name: string,
        _options: unknown,
        next: (jobs: Array<{ id: string; data: unknown }>) => Promise<void>,
      ) => {
        handler = next
        return 'worker-1'
      },
    } as unknown as Parameters<typeof createPrecomputeScheduler>[0]['boss']
    const scheduler = createPrecomputeScheduler({
      boss,
      listLocationIds: async () => ['location-1', 'location-2'],
      run: async () => {
        throw new Error('database unavailable')
      },
      logger: {
        info: () => undefined,
        error: (_message, error) => {
          if (error) errors.push(error.message)
        },
      },
    })

    await scheduler.ensureReady()
    expect(calls[0]).toMatchObject({
      name: PRECOMPUTE_QUEUE,
      data: { cron: PRECOMPUTE_DAILY_CRON },
    })
    await handler?.([{ id: 'daily-1', data: { scope: 'all' } }])
    expect(calls.filter((call) => call.name === PRECOMPUTE_QUEUE)).toHaveLength(
      3,
    )

    await expect(
      handler?.([
        {
          id: 'location-job-1',
          data: { scope: 'location', locationId: 'location-1' },
        },
      ]),
    ).rejects.toThrow('database unavailable')
    expect(errors).toEqual(['database unavailable'])
  })
})
