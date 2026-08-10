import { PgBoss, type SendOptions } from 'pg-boss'

import { createLogger, type Logger } from '@/src/server/observability/logger'

export const CONNECTOR_SYNC_QUEUE = 'pantryiq.connector-sync'
export const CONNECTOR_SYNC_CRON = '*/15 * * * *'
export const CONNECTOR_SYNC_TIME_BUDGET_MS = 30_000

export type ConnectorSyncConnection = {
  connectionId: string
  locationId: string
  provider: string
}

type ConnectorSyncJob = ConnectorSyncConnection
type QueueJob = { id: string; data: ConnectorSyncJob }
type BossLike = Pick<
  PgBoss,
  'start' | 'stop' | 'createQueue' | 'send' | 'schedule' | 'work'
>

type SyncResult = {
  rowsImported: number
  pages: number
  complete: boolean
}

export type ConnectorSyncSchedulerOptions = {
  boss: BossLike
  listConnections: () => Promise<ConnectorSyncConnection[]>
  sync: (connectionId: string) => Promise<SyncResult>
  onSyncComplete: (connection: ConnectorSyncConnection) => Promise<void>
  logger?: Pick<Logger, 'info' | 'error'>
  now?: () => Date
  cron?: string
}

const queueOptions = {
  policy: 'key_strict_fifo' as const,
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  notify: true,
}

function connectionKey(connectionId: string) {
  return `connector:${connectionId}`
}

function sendOptions(
  connectionId: string,
  db?: SendOptions['db'],
): SendOptions {
  return {
    singletonKey: connectionKey(connectionId),
    singletonSeconds: 900,
    ...(db ? { db } : {}),
  }
}

export function createConnectorSyncScheduler(
  options: ConnectorSyncSchedulerOptions,
) {
  let ready: Promise<void> | undefined
  const now = options.now ?? (() => new Date())
  const cron = options.cron ?? CONNECTOR_SYNC_CRON

  async function processJob(job: QueueJob) {
    const startedAt = now()
    try {
      const result = await options.sync(job.data.connectionId)
      await options.onSyncComplete(job.data)
      const durationMs = now().getTime() - startedAt.getTime()
      options.logger?.info('Connector sync completed', {
        event: 'connector.sync.completed',
        connectionId: job.data.connectionId,
        locationId: job.data.locationId,
        provider: job.data.provider,
        jobId: job.id,
        rowsImported: result.rowsImported,
        pages: result.pages,
        durationMs,
        ...(durationMs > CONNECTOR_SYNC_TIME_BUDGET_MS
          ? { overBudget: true }
          : {}),
      })
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      options.logger?.error('Connector sync failed', failure, {
        event: 'connector.sync.failed',
        connectionId: job.data.connectionId,
        locationId: job.data.locationId,
        provider: job.data.provider,
        jobId: job.id,
      })
      throw failure
    }
  }

  async function scheduleConnection(connection: ConnectorSyncConnection) {
    await options.boss.schedule(CONNECTOR_SYNC_QUEUE, cron, connection, {
      key: connectionKey(connection.connectionId),
      singletonKey: connectionKey(connection.connectionId),
      tz: 'UTC',
    })
  }

  async function ensureReady() {
    if (ready) return ready
    ready = (async () => {
      await options.boss.start()
      await options.boss.createQueue(CONNECTOR_SYNC_QUEUE, queueOptions)
      await options.boss.work(
        CONNECTOR_SYNC_QUEUE,
        { localConcurrency: 1 },
        async (jobs) => {
          const job = jobs[0] as QueueJob | undefined
          if (job) await processJob(job)
        },
      )
      for (const connection of await options.listConnections())
        await scheduleConnection(connection)
    })().catch((error) => {
      ready = undefined
      throw error
    })
    return ready
  }

  return {
    ensureReady,
    async registerConnection(connection: ConnectorSyncConnection) {
      await ensureReady()
      await scheduleConnection(connection)
    },
    async enqueueConnection(connection: ConnectorSyncConnection) {
      await ensureReady()
      return options.boss.send(
        CONNECTOR_SYNC_QUEUE,
        connection,
        sendOptions(connection.connectionId),
      )
    },
    async stop() {
      if (ready) await options.boss.stop({ graceful: true })
      ready = undefined
    },
  }
}

let defaultScheduler:
  ReturnType<typeof createConnectorSyncScheduler> | undefined

export function setConnectorSyncScheduler(
  scheduler: ReturnType<typeof createConnectorSyncScheduler>,
) {
  defaultScheduler = scheduler
}

export async function registerConnectorConnectionForSync(
  connection: ConnectorSyncConnection,
) {
  if (!defaultScheduler)
    throw new Error('The connector sync scheduler is not configured.')
  return defaultScheduler.registerConnection(connection)
}

export async function enqueueConnectorSync(
  connection: ConnectorSyncConnection,
) {
  if (!defaultScheduler)
    throw new Error('The connector sync scheduler is not configured.')
  return defaultScheduler.enqueueConnection(connection)
}

export function createDefaultConnectorSyncLogger() {
  return createLogger({ service: 'pantry-iq.connector-sync' })
}
