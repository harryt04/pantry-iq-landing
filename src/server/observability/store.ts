import { and, asc, desc, eq } from 'drizzle-orm'

import { observabilityEvents } from '@/src/server/db/schema'

export type PrecomputeTelemetry = {
  locationId: string
  referenceId: string
  status: 'succeeded' | 'failed'
  occurredAt: Date
  durationMs?: number
}

export type ImportTelemetry = {
  accountId: string
  locationId: string
  referenceId: string
  status: 'succeeded' | 'failed'
  occurredAt: Date
  rowsImported?: number
}

export type LlmTelemetry = {
  accountId: string
  locationId: string
  referenceId: string
  status: 'succeeded' | 'failed'
  occurredAt: Date
  inputTokens: number
  outputTokens: number
  costMicros: number
  currency: string
}

export type PersistedPrecomputeHealth = {
  locationId: string
  lastSuccessfulAt: Date | null
  lastRunDurationMs: number | null
  lastFailureAt: Date | null
  failureCount: number
  isStale: boolean
}

export type PersistedImportHealth = {
  locationId: string
  successfulImportCount: number
  failedImportCount: number
  totalImportCount: number
  successRate: number
}

export type PersistedDailyLlmSpend = {
  accountId: string
  day: string
  queryCount: number
  inputTokens: number
  outputTokens: number
  costMicros: string
  currency: string
}

type DatabaseLike = typeof import('@/src/server/db/client').db

function assertDate(value: Date, field: string) {
  if (Number.isNaN(value.getTime())) throw new Error(`${field} is invalid`)
}

function assertNonNegativeInteger(value: number | undefined, field: string) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

function eventValues(event: {
  accountId?: string
  locationId?: string
  eventType: 'precompute' | 'import' | 'llm-query'
  status: 'succeeded' | 'failed'
  referenceId: string
  occurredAt: Date
  durationMs?: number
  rowsImported?: number
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  currency?: string
}) {
  assertDate(event.occurredAt, 'occurredAt')
  if (!event.referenceId.trim())
    throw new Error('referenceId must not be empty')
  assertNonNegativeInteger(event.durationMs, 'durationMs')
  assertNonNegativeInteger(event.rowsImported, 'rowsImported')
  assertNonNegativeInteger(event.inputTokens, 'inputTokens')
  assertNonNegativeInteger(event.outputTokens, 'outputTokens')
  if (event.costMicros !== undefined)
    assertNonNegativeNumber(event.costMicros, 'costMicros')
  if (event.currency !== undefined && !event.currency.trim())
    throw new Error('currency must not be empty')

  return {
    ...(event.accountId ? { accountId: event.accountId } : {}),
    ...(event.locationId ? { locationId: event.locationId } : {}),
    eventType: event.eventType,
    status: event.status,
    referenceId: event.referenceId,
    occurredAt: event.occurredAt,
    ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    ...(event.rowsImported !== undefined
      ? { rowsImported: event.rowsImported }
      : {}),
    ...(event.inputTokens !== undefined
      ? { inputTokens: event.inputTokens }
      : {}),
    ...(event.outputTokens !== undefined
      ? { outputTokens: event.outputTokens }
      : {}),
    ...(event.costMicros !== undefined
      ? { costMicros: String(event.costMicros) }
      : {}),
    ...(event.currency ? { currency: event.currency } : {}),
  }
}

async function database(): Promise<DatabaseLike> {
  const { db } = await import('@/src/server/db/client')
  return db
}

export async function recordPrecomputeEvent(event: PrecomputeTelemetry) {
  const db = await database()
  await db
    .insert(observabilityEvents)
    .values(
      eventValues({
        ...event,
        eventType: 'precompute',
      }),
    )
    .onConflictDoNothing({
      target: [observabilityEvents.eventType, observabilityEvents.referenceId],
    })
}

export async function recordImportEvent(event: ImportTelemetry) {
  const db = await database()
  await db
    .insert(observabilityEvents)
    .values(
      eventValues({
        ...event,
        eventType: 'import',
      }),
    )
    .onConflictDoNothing({
      target: [observabilityEvents.eventType, observabilityEvents.referenceId],
    })
}

export async function recordLlmQueryEvent(event: LlmTelemetry) {
  const db = await database()
  await db
    .insert(observabilityEvents)
    .values(
      eventValues({
        ...event,
        eventType: 'llm-query',
      }),
    )
    .onConflictDoNothing({
      target: [observabilityEvents.eventType, observabilityEvents.referenceId],
    })
}

async function eventsFor(
  db: DatabaseLike,
  eventType: 'precompute' | 'import' | 'llm-query',
  locationId?: string,
  accountId?: string,
) {
  return db
    .select()
    .from(observabilityEvents)
    .where(
      and(
        eq(observabilityEvents.eventType, eventType),
        ...(locationId ? [eq(observabilityEvents.locationId, locationId)] : []),
        ...(accountId ? [eq(observabilityEvents.accountId, accountId)] : []),
      ),
    )
    .orderBy(desc(observabilityEvents.occurredAt), asc(observabilityEvents.id))
}

function integerFromDatabase(value: number | string | null, field: string) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error(`${field} is outside the safe integer range`)
  return parsed
}

function addIntegerStrings(left: string, right: string, field: string) {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right))
    throw new Error(`${field} must be a non-negative integer`)
  const total = BigInt(left) + BigInt(right)
  return total.toString()
}

export async function getPrecomputeHealth(
  locationId: string,
  options: { now?: Date; staleAfterMs?: number } = {},
): Promise<PersistedPrecomputeHealth> {
  const now = options.now ?? new Date()
  const staleAfterMs = options.staleAfterMs ?? 24 * 60 * 60 * 1000
  assertDate(now, 'now')
  if (!Number.isSafeInteger(staleAfterMs) || staleAfterMs < 0)
    throw new Error('staleAfterMs must be a non-negative safe integer')

  const rows = await eventsFor(await database(), 'precompute', locationId)
  const successes = rows.filter((row) => row.status === 'succeeded')
  const failures = rows.filter((row) => row.status === 'failed')
  const lastSuccessfulAt = successes[0]?.occurredAt ?? null
  return {
    locationId,
    lastSuccessfulAt,
    lastRunDurationMs:
      successes[0]?.durationMs === null ||
      successes[0]?.durationMs === undefined
        ? null
        : integerFromDatabase(successes[0].durationMs, 'durationMs'),
    lastFailureAt: failures[0]?.occurredAt ?? null,
    failureCount: failures.length,
    isStale:
      !lastSuccessfulAt ||
      now.getTime() - lastSuccessfulAt.getTime() >= staleAfterMs,
  }
}

export async function getImportHealth(
  locationId: string,
): Promise<PersistedImportHealth> {
  const rows = await eventsFor(await database(), 'import', locationId)
  const successfulImportCount = rows.filter(
    (row) => row.status === 'succeeded',
  ).length
  const failedImportCount = rows.filter((row) => row.status === 'failed').length
  const totalImportCount = successfulImportCount + failedImportCount
  return {
    locationId,
    successfulImportCount,
    failedImportCount,
    totalImportCount,
    successRate:
      totalImportCount === 0 ? 0 : successfulImportCount / totalImportCount,
  }
}

export async function listDailyLlmSpend(
  accountId: string,
): Promise<PersistedDailyLlmSpend[]> {
  const rows = await eventsFor(
    await database(),
    'llm-query',
    undefined,
    accountId,
  )
  const byDay = new Map<string, PersistedDailyLlmSpend>()

  for (const row of rows) {
    const day = row.occurredAt.toISOString().slice(0, 10)
    const inputTokens = integerFromDatabase(row.inputTokens, 'inputTokens')
    const outputTokens = integerFromDatabase(row.outputTokens, 'outputTokens')
    const costMicros = row.costMicros ?? '0'
    const currency = row.currency ?? 'USD'
    const existing = byDay.get(day)
    if (existing && existing.currency !== currency)
      throw new Error('Cannot aggregate LLM spend across currencies')

    byDay.set(day, {
      accountId,
      day,
      queryCount: (existing?.queryCount ?? 0) + 1,
      inputTokens: (existing?.inputTokens ?? 0) + inputTokens,
      outputTokens: (existing?.outputTokens ?? 0) + outputTokens,
      costMicros: addIntegerStrings(
        existing?.costMicros ?? '0',
        costMicros,
        'costMicros',
      ),
      currency: existing?.currency ?? currency,
    })
  }

  return [...byDay.values()].sort((left, right) =>
    left.day.localeCompare(right.day),
  )
}
