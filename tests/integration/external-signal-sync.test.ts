import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import {
  closeAppDatabaseClient,
  integrationDatabaseEnabled,
  openTestDatabase,
  type OpenTestDatabase,
} from '../helpers/test-database'
import type { ExternalSignalInput } from '../../src/server/staffing/external-signals'

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const NOW = new Date('2026-08-11T12:00:00.000Z')
const FROM = new Date('2026-08-01T00:00:00.000Z')
const TO = new Date('2026-08-08T00:00:00.000Z')
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let sync: typeof import('../../src/server/staffing/external-signal-sync')

function signal(
  overrides: Partial<ExternalSignalInput> = {},
): ExternalSignalInput {
  return {
    id: '00000000-0000-4000-8000-00000000e001',
    kind: 'weather',
    source: 'weather-api',
    externalId: 'forecast-1',
    businessDate: '2026-08-01',
    status: 'observed',
    feature: 'temperature',
    condition: 'warm',
    value: '24.5000',
    retrievedAt: NOW,
    validFrom: FROM,
    validTo: TO,
    ...overrides,
  }
}

function provider(
  response: {
    signals: readonly ExternalSignalInput[]
    costMicros: string
    currency: string
  },
  source = 'weather-api',
) {
  return {
    source,
    fetch: async (input: {
      locationId: string
      from: Date
      to: Date
      now: Date
    }) => {
      void input
      return response
    },
  }
}

describe.skipIf(!integrationDatabaseEnabled())('external signal sync', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    sync = await import('../../src/server/staffing/external-signal-sync')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from external_signals`
    await sql`delete from external_signal_fetches`
    await sql`delete from locations`
    await sql`delete from "user"`

    await sql`
      insert into "user" (id, name, email)
      values (${OWNER_ID}, 'Owner', 'owner@example.com')
    `
    await sql`
      insert into locations (id, user_id, name)
      values (${LOCATION_ID}, ${OWNER_ID}, 'North')
    `
  })

  it('records a successful fetch and persists normalized signal provenance', async () => {
    let received: {
      locationId: string
      from: Date
      to: Date
      now: Date
    } | null = null
    const result = await sync.syncExternalSignals({
      locationId: LOCATION_ID,
      provider: {
        ...provider({
          signals: [signal()],
          costMicros: '123456',
          currency: 'USD',
        }),
        fetch: async (input) => {
          received = input
          return {
            signals: [signal()],
            costMicros: '123456',
            currency: 'USD',
          }
        },
      },
      from: FROM,
      to: TO,
      now: NOW,
    })

    expect(result).toMatchObject({
      source: 'weather-api',
      rowCount: 1,
      costMicros: '123456',
      currency: 'USD',
    })
    expect(received).toEqual({
      locationId: LOCATION_ID,
      from: FROM,
      to: TO,
      now: NOW,
    })

    const { sql } = opened!.database
    const [fetch] = await sql<
      {
        id: string
        status: string
        rowCount: number
        costMicros: string
        currency: string
        requestedAt: string
        completedAt: string
        error: string | null
      }[]
    >`
      select id, status, row_count as "rowCount", cost_micros as "costMicros",
             currency, requested_at as "requestedAt",
             completed_at as "completedAt", error
      from external_signal_fetches
      where location_id = ${LOCATION_ID}
    `
    expect(fetch).toMatchObject({
      id: result.fetchId,
      status: 'succeeded',
      rowCount: 1,
      costMicros: '123456',
      currency: 'USD',
      error: null,
    })
    expect(new Date(fetch!.requestedAt).toISOString()).toBe(NOW.toISOString())
    expect(new Date(fetch!.completedAt).toISOString()).toBe(NOW.toISOString())

    const [stored] = await sql<
      {
        id: string
        fetchId: string
        rawData: Record<string, unknown>
        sourceUrl: string | null
        value: string
      }[]
    >`
      select id, fetch_id as "fetchId", raw_data as "rawData",
             source_url as "sourceUrl", value
      from external_signals
      where location_id = ${LOCATION_ID}
    `
    expect(stored).toMatchObject({
      id: '00000000-0000-4000-8000-00000000e001',
      fetchId: result.fetchId,
      rawData: {
        kind: 'weather',
        feature: 'temperature',
        condition: 'warm',
        value: '24.5000',
      },
      sourceUrl: null,
      value: '24.5000',
    })
  })

  it('upserts an existing provider feature and points it at the newest fetch', async () => {
    const first = await sync.syncExternalSignals({
      locationId: LOCATION_ID,
      provider: provider({
        signals: [signal()],
        costMicros: '100',
        currency: 'USD',
      }),
      from: FROM,
      to: TO,
      now: NOW,
    })
    const second = await sync.syncExternalSignals({
      locationId: LOCATION_ID,
      provider: provider({
        signals: [
          signal({
            id: '00000000-0000-4000-8000-00000000e002',
            status: 'forecast',
            condition: 'hot',
            value: '31.2500',
            sourceUrl: 'https://weather.example/forecast-1',
            rawData: { provider: 'weather-api', version: 2 },
          }),
        ],
        costMicros: '200',
        currency: 'USD',
      }),
      from: FROM,
      to: TO,
      now: new Date(NOW.getTime() + 60_000),
    })

    const { sql } = opened!.database
    const rows = await sql<
      {
        id: string
        fetchId: string
        status: string
        condition: string
        value: string
        sourceUrl: string | null
        rawData: Record<string, unknown>
      }[]
    >`
      select id, fetch_id as "fetchId", status, condition, value,
             source_url as "sourceUrl", raw_data as "rawData"
      from external_signals
      where location_id = ${LOCATION_ID}
    `
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: '00000000-0000-4000-8000-00000000e001',
      fetchId: second.fetchId,
      status: 'forecast',
      condition: 'hot',
      value: '31.2500',
      sourceUrl: 'https://weather.example/forecast-1',
      rawData: { provider: 'weather-api', version: 2 },
    })

    const fetches = await sql<{ id: string; costMicros: string }[]>`
      select id, cost_micros as "costMicros"
      from external_signal_fetches
      where location_id = ${LOCATION_ID}
      order by requested_at
    `
    expect(fetches).toEqual([
      { id: first.fetchId, costMicros: '100' },
      { id: second.fetchId, costMicros: '200' },
    ])
  })

  it('records a successful zero-row fetch without creating signal rows', async () => {
    const result = await sync.syncExternalSignals({
      locationId: LOCATION_ID,
      provider: provider({ signals: [], costMicros: '0', currency: 'USD' }),
      from: FROM,
      to: TO,
      now: NOW,
    })

    const { sql } = opened!.database
    const [fetch] = await sql<{ status: string; rowCount: number }[]>`
      select status, row_count as "rowCount"
      from external_signal_fetches
      where id = ${result.fetchId}
    `
    const [count] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from external_signals
      where location_id = ${LOCATION_ID}
    `

    expect(fetch).toEqual({ status: 'succeeded', rowCount: 0 })
    expect(count?.count).toBe('0')
  })

  it('journals provider failures and leaves signal rows untouched', async () => {
    const failure = new Error('weather provider timed out')

    await expect(
      sync.syncExternalSignals({
        locationId: LOCATION_ID,
        provider: {
          source: 'weather-api',
          fetch: async () => {
            throw failure
          },
        },
        from: FROM,
        to: TO,
        now: NOW,
      }),
    ).rejects.toBe(failure)

    const { sql } = opened!.database
    const [fetch] = await sql<
      { status: string; rowCount: number; error: string | null }[]
    >`
      select status, row_count as "rowCount", error
      from external_signal_fetches
      where location_id = ${LOCATION_ID}
    `
    const [count] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from external_signals
      where location_id = ${LOCATION_ID}
    `

    expect(fetch).toEqual({
      status: 'failed',
      rowCount: 0,
      error: 'weather provider timed out',
    })
    expect(count?.count).toBe('0')
  })
})
