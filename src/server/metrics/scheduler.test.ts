import { describe, expect, it, vi } from 'vitest'

import {
  createPrecomputeScheduler,
  type PrecomputeSchedulerOptions,
} from './scheduler'

function schedulerWith(
  run: PrecomputeSchedulerOptions['run'],
  telemetry: NonNullable<PrecomputeSchedulerOptions['telemetry']>,
) {
  let worker:
    | ((
        jobs: Array<{
          id: string
          data: { scope: 'location'; locationId: string }
        }>,
      ) => Promise<void>)
    | undefined
  const boss = {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    createQueue: vi.fn(async () => undefined),
    send: vi.fn(async () => 'job-id'),
    schedule: vi.fn(async () => undefined),
    work: vi.fn(async (_queue, _options, handler) => {
      worker = handler as typeof worker
    }),
  } as unknown as PrecomputeSchedulerOptions['boss']
  const logger = { info: vi.fn(), error: vi.fn() }
  const scheduler = createPrecomputeScheduler({
    boss,
    listLocationIds: async () => ['location-1'],
    run,
    logger,
    telemetry,
    now: () => new Date('2026-08-09T12:00:00.000Z'),
  })

  return { scheduler, boss, logger, getWorker: () => worker }
}

describe('precompute scheduler observability', () => {
  it('records a completed run with its duration', async () => {
    const telemetry = vi.fn(async () => undefined)
    const { scheduler, getWorker } = schedulerWith(
      async () => ({
        id: 'run-1',
        completedAt: new Date('2026-08-09T12:00:02.500Z'),
      }),
      telemetry,
    )

    await scheduler.ensureReady()
    await getWorker()?.([
      { id: 'job-1', data: { scope: 'location', locationId: 'location-1' } },
    ])

    expect(telemetry).toHaveBeenCalledWith({
      locationId: 'location-1',
      referenceId: 'run-1',
      status: 'succeeded',
      occurredAt: new Date('2026-08-09T12:00:02.500Z'),
      durationMs: 2500,
    })
  })

  it('records a failed run and emits the alert log before retrying the job', async () => {
    const telemetry = vi.fn(async () => undefined)
    const { scheduler, getWorker, logger } = schedulerWith(async () => {
      throw new Error('database unavailable')
    }, telemetry)

    await scheduler.ensureReady()
    await expect(
      getWorker()?.([
        { id: 'job-2', data: { scope: 'location', locationId: 'location-1' } },
      ]),
    ).rejects.toThrow('database unavailable')

    expect(telemetry).toHaveBeenCalledWith({
      locationId: 'location-1',
      referenceId: 'job-2',
      status: 'failed',
      occurredAt: new Date('2026-08-09T12:00:00.000Z'),
    })
    expect(logger.error).toHaveBeenCalledWith(
      'Precompute failed',
      expect.any(Error),
      expect.objectContaining({ event: 'precompute.failed' }),
    )
  })
})
