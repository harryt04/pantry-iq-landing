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

/**
 * `src/server/observability/store.ts` was one of the largest untested modules
 * in the 2026-08-10 audit. It decides whether an operator sees a location as
 * healthy, and it reports LLM spend per account, so both a wrong aggregate and
 * a leak across accounts matter.
 */

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const NOW = new Date('2026-08-10T12:00:00.000Z')
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let store: typeof import('../../src/server/observability/store')

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000)
}

describe.skipIf(!integrationDatabaseEnabled())('observability store', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    store = await import('../../src/server/observability/store')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from observability_events`
    await sql`delete from locations`
    await sql`delete from "user"`

    await sql`
      insert into "user" (id, name, email)
      values
        (${OWNER_ID}, 'Owner', 'owner@example.com'),
        (${OTHER_OWNER_ID}, 'Other', 'other@example.com')
    `
    await sql`
      insert into locations (id, user_id, name)
      values
        (${LOCATION_ID}, ${OWNER_ID}, 'North'),
        (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'South')
    `
  })

  describe('precompute health', () => {
    it('reports a location with no runs as stale', async () => {
      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health).toMatchObject({
        locationId: LOCATION_ID,
        lastSuccessfulAt: null,
        failureCount: 0,
        isStale: true,
      })
    })

    it('reports a recent success as fresh, with its duration', async () => {
      await store.recordPrecomputeEvent({
        locationId: LOCATION_ID,
        referenceId: 'run-1',
        status: 'succeeded',
        occurredAt: hoursAgo(1),
        durationMs: 4200,
      })

      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health.isStale).toBe(false)
      expect(health.lastRunDurationMs).toBe(4200)
      expect(health.lastSuccessfulAt?.toISOString()).toBe(
        hoursAgo(1).toISOString(),
      )
    })

    it('treats a success older than the staleness window as stale', async () => {
      await store.recordPrecomputeEvent({
        locationId: LOCATION_ID,
        referenceId: 'run-old',
        status: 'succeeded',
        occurredAt: hoursAgo(48),
      })

      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health.isStale).toBe(true)
    })

    it('counts failures without letting them mask the last success', async () => {
      await store.recordPrecomputeEvent({
        locationId: LOCATION_ID,
        referenceId: 'run-ok',
        status: 'succeeded',
        occurredAt: hoursAgo(2),
      })
      for (const reference of ['fail-1', 'fail-2']) {
        await store.recordPrecomputeEvent({
          locationId: LOCATION_ID,
          referenceId: reference,
          status: 'failed',
          occurredAt: hoursAgo(1),
        })
      }

      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health.failureCount).toBe(2)
      expect(health.lastSuccessfulAt).not.toBeNull()
      expect(health.isStale).toBe(false)
    })

    it('ignores another location events', async () => {
      await store.recordPrecomputeEvent({
        locationId: OTHER_LOCATION_ID,
        referenceId: 'other-run',
        status: 'succeeded',
        occurredAt: hoursAgo(1),
      })

      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health.lastSuccessfulAt).toBeNull()
      expect(health.isStale).toBe(true)
    })

    it('records a repeated reference id only once', async () => {
      // Retried jobs re-report the same run. Counting it twice would
      // exaggerate the failure rate an operator sees.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await store.recordPrecomputeEvent({
          locationId: LOCATION_ID,
          referenceId: 'run-retry',
          status: 'failed',
          occurredAt: hoursAgo(1),
        })
      }

      const health = await store.getPrecomputeHealth(LOCATION_ID, { now: NOW })

      expect(health.failureCount).toBe(1)
    })

    it('refuses a negative staleness window rather than guessing', async () => {
      await expect(
        store.getPrecomputeHealth(LOCATION_ID, { now: NOW, staleAfterMs: -1 }),
      ).rejects.toThrow(/staleAfterMs/)
    })
  })

  describe('import health', () => {
    it('reports a zero success rate as zero, not as a divide by zero', async () => {
      const health = await store.getImportHealth(LOCATION_ID)

      expect(health).toMatchObject({
        totalImportCount: 0,
        successRate: 0,
      })
      expect(Number.isNaN(health.successRate)).toBe(false)
    })

    it('computes the success rate across recorded imports', async () => {
      await store.recordImportEvent({
        accountId: OWNER_ID,
        locationId: LOCATION_ID,
        referenceId: 'import-1',
        status: 'succeeded',
        occurredAt: hoursAgo(3),
        rowsImported: 40,
      })
      await store.recordImportEvent({
        accountId: OWNER_ID,
        locationId: LOCATION_ID,
        referenceId: 'import-2',
        status: 'failed',
        occurredAt: hoursAgo(2),
      })

      const health = await store.getImportHealth(LOCATION_ID)

      expect(health).toMatchObject({
        successfulImportCount: 1,
        failedImportCount: 1,
        totalImportCount: 2,
        successRate: 0.5,
      })
    })
  })

  describe('daily LLM spend', () => {
    async function recordSpend(
      accountId: string,
      referenceId: string,
      occurredAt: Date,
      costMicros: number,
    ) {
      await store.recordLlmQueryEvent({
        accountId,
        locationId: accountId === OWNER_ID ? LOCATION_ID : OTHER_LOCATION_ID,
        referenceId,
        status: 'succeeded',
        occurredAt,
        inputTokens: 100,
        outputTokens: 20,
        costMicros,
        currency: 'USD',
      })
    }

    it('reports nothing for an account that has asked nothing', async () => {
      await expect(store.listDailyLlmSpend(OWNER_ID)).resolves.toEqual([])
    })

    it('sums a day of queries for one account', async () => {
      await recordSpend(
        OWNER_ID,
        'q-1',
        new Date('2026-08-09T09:00:00Z'),
        1_500,
      )
      await recordSpend(
        OWNER_ID,
        'q-2',
        new Date('2026-08-09T17:00:00Z'),
        2_500,
      )

      const spend = await store.listDailyLlmSpend(OWNER_ID)

      expect(spend).toHaveLength(1)
      expect(spend[0]).toMatchObject({
        accountId: OWNER_ID,
        day: '2026-08-09',
        queryCount: 2,
        inputTokens: 200,
        outputTokens: 40,
        costMicros: '4000',
        currency: 'USD',
      })
    })

    it('never mixes one account spend into another', async () => {
      await recordSpend(
        OWNER_ID,
        'q-1',
        new Date('2026-08-09T09:00:00Z'),
        1_000,
      )
      await recordSpend(
        OTHER_OWNER_ID,
        'q-2',
        new Date('2026-08-09T09:00:00Z'),
        9_000,
      )

      const spend = await store.listDailyLlmSpend(OWNER_ID)

      expect(spend).toHaveLength(1)
      expect(spend[0]?.costMicros).toBe('1000')
      expect(spend[0]?.queryCount).toBe(1)
    })

    it('returns days in chronological order', async () => {
      await recordSpend(OWNER_ID, 'q-3', new Date('2026-08-09T09:00:00Z'), 100)
      await recordSpend(OWNER_ID, 'q-1', new Date('2026-08-07T09:00:00Z'), 100)
      await recordSpend(OWNER_ID, 'q-2', new Date('2026-08-08T09:00:00Z'), 100)

      const spend = await store.listDailyLlmSpend(OWNER_ID)

      expect(spend.map(({ day }) => day)).toEqual([
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
      ])
    })

    it('refuses to add spend recorded in two currencies', async () => {
      await recordSpend(
        OWNER_ID,
        'q-1',
        new Date('2026-08-09T09:00:00Z'),
        1_000,
      )
      await store.recordLlmQueryEvent({
        accountId: OWNER_ID,
        locationId: LOCATION_ID,
        referenceId: 'q-eur',
        status: 'succeeded',
        occurredAt: new Date('2026-08-09T10:00:00Z'),
        inputTokens: 10,
        outputTokens: 2,
        costMicros: 500,
        currency: 'EUR',
      })

      // Silently adding euros to dollars would produce a confident wrong total.
      await expect(store.listDailyLlmSpend(OWNER_ID)).rejects.toThrow(
        /currencies/,
      )
    })
  })
})
