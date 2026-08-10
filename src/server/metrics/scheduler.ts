import { eq, sql as drizzleSql } from 'drizzle-orm'
import { fromDrizzle, PgBoss, type SendOptions } from 'pg-boss'

import { locations } from '@/src/server/db/schema'
import { createLogger, type Logger } from '@/src/server/observability/logger'
import { recordPrecomputeEvent } from '@/src/server/observability/store'

import { runPrecomputeForLocation } from './precompute'

export const PRECOMPUTE_QUEUE = 'pantryiq.precompute'
export const PRECOMPUTE_DAILY_CRON = '0 4 * * *'
export const PRECOMPUTE_DAILY_SCHEDULE_KEY = 'pantryiq-daily'
export const PRECOMPUTE_TIME_BUDGET_MS = 30_000

type LocationJob = { scope: 'location'; locationId: string }
type DailyJob = { scope: 'all' }
export type PrecomputeJob = LocationJob | DailyJob

type QueueJob = { id: string; data: PrecomputeJob }
type BossLike = Pick<
  PgBoss,
  'start' | 'stop' | 'createQueue' | 'send' | 'schedule' | 'work'
>

import type { db } from '@/src/server/db/client'

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type PrecomputeSchedulerOptions = {
  boss: BossLike
  listLocationIds: () => Promise<string[]>
  run: (locationId: string) => Promise<{ id: string; completedAt: Date | null }>
  logger?: Pick<Logger, 'info' | 'error'>
  telemetry?: (
    event: Parameters<typeof recordPrecomputeEvent>[0],
  ) => Promise<void>
  now?: () => Date
}

const queueOptions = {
  policy: 'key_strict_fifo' as const,
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  notify: true,
}

function locationKey(locationId: string) {
  return `location:${locationId}`
}

function sendOptions(locationId: string, db?: SendOptions['db']): SendOptions {
  return {
    singletonKey: locationKey(locationId),
    singletonSeconds: 300,
    ...(db ? { db } : {}),
  }
}

export function createPrecomputeScheduler(options: PrecomputeSchedulerOptions) {
  let ready: Promise<void> | undefined
  const now = options.now ?? (() => new Date())

  async function processLocation(locationId: string, jobId: string) {
    const startedAt = now()
    try {
      const run = await options.run(locationId)
      const completedAt = run.completedAt ?? now()
      const durationMs = completedAt.getTime() - startedAt.getTime()
      try {
        await options.telemetry?.({
          locationId,
          referenceId: run.id,
          status: 'succeeded',
          occurredAt: completedAt,
          durationMs,
        })
      } catch (telemetryError) {
        const failure =
          telemetryError instanceof Error
            ? telemetryError
            : new Error(String(telemetryError))
        options.logger?.error(
          'Precompute telemetry could not be recorded',
          failure,
          {
            event: 'observability.write.failed',
            locationId,
          },
        )
      }
      options.logger?.info('Precompute completed', {
        event: 'precompute.completed',
        locationId,
        runId: run.id,
        jobId,
        durationMs,
        ...(durationMs > PRECOMPUTE_TIME_BUDGET_MS ? { overBudget: true } : {}),
      })
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      try {
        await options.telemetry?.({
          locationId,
          referenceId: jobId,
          status: 'failed',
          occurredAt: now(),
        })
      } catch (telemetryError) {
        const telemetryFailure =
          telemetryError instanceof Error
            ? telemetryError
            : new Error(String(telemetryError))
        options.logger?.error(
          'Precompute telemetry could not be recorded',
          telemetryFailure,
          {
            event: 'observability.write.failed',
            locationId,
          },
        )
      }
      options.logger?.error('Precompute failed', failure, {
        event: 'precompute.failed',
        locationId,
        jobId,
      })
      throw failure
    }
  }

  async function processJob(job: QueueJob) {
    if (job.data.scope === 'location') {
      await processLocation(job.data.locationId, job.id)
      return
    }

    // Fan out the daily schedule so one bad location does not retry and repeat
    // successful work for every other location.
    for (const locationId of await options.listLocationIds()) {
      await options.boss.send(
        PRECOMPUTE_QUEUE,
        { scope: 'location', locationId },
        sendOptions(locationId),
      )
    }
  }

  async function ensureReady() {
    if (ready) return ready
    ready = (async () => {
      await options.boss.start()
      await options.boss.createQueue(PRECOMPUTE_QUEUE, queueOptions)
      await options.boss.schedule(
        PRECOMPUTE_QUEUE,
        PRECOMPUTE_DAILY_CRON,
        { scope: 'all' },
        {
          key: PRECOMPUTE_DAILY_SCHEDULE_KEY,
          singletonKey: PRECOMPUTE_DAILY_SCHEDULE_KEY,
          tz: 'UTC',
        },
      )
      await options.boss.work(
        PRECOMPUTE_QUEUE,
        { localConcurrency: 1 },
        async (jobs) => {
          const job = jobs[0] as QueueJob | undefined
          if (job) await processJob(job)
        },
      )
    })().catch((error) => {
      ready = undefined
      throw error
    })
    return ready
  }

  return {
    ensureReady,
    async enqueueLocation(locationId: string) {
      await ensureReady()
      return options.boss.send(
        PRECOMPUTE_QUEUE,
        { scope: 'location', locationId },
        sendOptions(locationId),
      )
    },
    async enqueueLocationInTransaction(
      tx: DatabaseTransaction,
      locationId: string,
    ) {
      await ensureReady()
      return options.boss.send(
        PRECOMPUTE_QUEUE,
        { scope: 'location', locationId },
        sendOptions(locationId, fromDrizzle(tx, drizzleSql)),
      )
    },
    async stop() {
      if (ready) await options.boss.stop({ graceful: true })
      ready = undefined
    },
  }
}

let defaultScheduler: ReturnType<typeof createPrecomputeScheduler> | undefined

async function listActiveLocationIds() {
  const { db } = await import('@/src/server/db/client')
  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.isActive, true))
  return rows.map((row) => row.id)
}

function defaultSchedulerInstance() {
  if (defaultScheduler) return defaultScheduler
  const connectionString = process.env.DATABASE_URL
  if (!connectionString)
    throw new Error('DATABASE_URL is required for precompute jobs.')

  const boss = new PgBoss({
    connectionString,
    application_name: 'pantry-iq-precompute',
    useListenNotify: true,
  })
  const logger = createLogger({ service: 'pantry-iq.precompute' })
  defaultScheduler = createPrecomputeScheduler({
    boss,
    listLocationIds: listActiveLocationIds,
    run: async (locationId) => {
      const run = await runPrecomputeForLocation(locationId)
      if (!run) throw new Error('The precompute run did not finish.')
      return { id: run.id, completedAt: run.completedAt }
    },
    logger,
    telemetry: recordPrecomputeEvent,
  })
  return defaultScheduler
}

export async function enqueuePrecomputeForLocation(locationId: string) {
  return defaultSchedulerInstance().enqueueLocation(locationId)
}

export async function enqueuePrecomputeForLocationInTransaction(
  tx: DatabaseTransaction,
  locationId: string,
) {
  return defaultSchedulerInstance().enqueueLocationInTransaction(tx, locationId)
}

export async function startPrecomputeScheduler() {
  await defaultSchedulerInstance().ensureReady()
}

export async function stopPrecomputeScheduler() {
  if (defaultScheduler) await defaultScheduler.stop()
}
