import { describe, expect, it } from 'vitest'

import {
  CONNECTOR_SYNC_CRON,
  CONNECTOR_SYNC_QUEUE,
  createConnectorSyncScheduler,
} from './scheduler'

const connection = {
  connectionId: 'connection-1',
  locationId: 'location-1',
  provider: 'square',
}

describe('connector sync scheduler', () => {
  it('registers each connection on a recurring incremental queue', async () => {
    const calls: Array<{ name: string; data: unknown; options?: unknown }> = []
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
      work: async () => 'worker-1',
    } as unknown as Parameters<typeof createConnectorSyncScheduler>[0]['boss']

    const scheduler = createConnectorSyncScheduler({
      boss,
      listConnections: async () => [connection],
      sync: async () => ({ rowsImported: 2, pages: 1, complete: true }),
      onSyncComplete: async () => undefined,
    })

    await scheduler.ensureReady()
    expect(calls[0]).toMatchObject({
      name: CONNECTOR_SYNC_QUEUE,
      data: { cron: CONNECTOR_SYNC_CRON, data: connection },
      options: {
        key: 'connector:connection-1',
        singletonKey: 'connector:connection-1',
      },
    })
  })

  it('enqueues with a connection singleton and registers new connections', async () => {
    const calls: Array<{ name: string; data: unknown; options?: unknown }> = []
    const boss = {
      start: async () => undefined,
      stop: async () => undefined,
      createQueue: async () => undefined,
      send: async (name: string, data: unknown, options?: unknown) => {
        calls.push({ name, data, options })
        return 'job-1'
      },
      schedule: async (name: string, _cron: string, data: unknown) => {
        calls.push({ name, data })
      },
      work: async () => 'worker-1',
    } as unknown as Parameters<typeof createConnectorSyncScheduler>[0]['boss']
    let completionCount = 0
    const scheduler = createConnectorSyncScheduler({
      boss,
      listConnections: async () => [],
      sync: async () => ({ rowsImported: 0, pages: 1, complete: true }),
      onSyncComplete: async () => {
        completionCount += 1
      },
    })

    await scheduler.registerConnection(connection)
    await scheduler.enqueueConnection(connection)

    expect(calls).toEqual([
      { name: CONNECTOR_SYNC_QUEUE, data: connection },
      {
        name: CONNECTOR_SYNC_QUEUE,
        data: connection,
        options: {
          singletonKey: 'connector:connection-1',
          singletonSeconds: 900,
        },
      },
    ])
    expect(completionCount).toBe(0)
  })

  it('runs one incremental job and hands completion to precompute', async () => {
    let handler:
      | ((jobs: Array<{ id: string; data: unknown }>) => Promise<void>)
      | undefined
    const boss = {
      start: async () => undefined,
      stop: async () => undefined,
      createQueue: async () => undefined,
      send: async () => 'job-1',
      schedule: async () => undefined,
      work: async (
        _name: string,
        _options: unknown,
        next: (jobs: Array<{ id: string; data: unknown }>) => Promise<void>,
      ) => {
        handler = next
        return 'worker-1'
      },
    } as unknown as Parameters<typeof createConnectorSyncScheduler>[0]['boss']
    const synced: string[] = []
    const completed: string[] = []
    const scheduler = createConnectorSyncScheduler({
      boss,
      listConnections: async () => [],
      sync: async (connectionId) => {
        synced.push(connectionId)
        return { rowsImported: 4, pages: 2, complete: true }
      },
      onSyncComplete: async (value) => {
        completed.push(value.locationId)
      },
    })

    await scheduler.ensureReady()
    await handler?.([{ id: 'job-1', data: connection }])

    expect(synced).toEqual(['connection-1'])
    expect(completed).toEqual(['location-1'])
  })
})
