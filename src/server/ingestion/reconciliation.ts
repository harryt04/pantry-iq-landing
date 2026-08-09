import { and, asc, eq, sql } from 'drizzle-orm'

import {
  inventorySnapshots,
  purchaseOrderItems,
  purchaseOrders,
  reconciliationConflicts,
  transactions,
} from '@/src/server/db/schema'

async function getDatabase() {
  return (await import('@/src/server/db/client')).db
}

export type ReconciliationRecordKind =
  'transaction' | 'purchase_order' | 'inventory'

export type ReconciliationRecord = {
  kind: ReconciliationRecordKind
  source: string
  externalId: string | null
  occurredAt: Date
}

export type ReconciliationConflictType = 'external-id' | 'period-overlap'
export type ReconciliationStatus = 'unresolved' | 'resolved'

export type ReconciliationConflict = {
  id?: string
  locationId?: string
  recordKind: ReconciliationRecordKind
  conflictType: ReconciliationConflictType
  identityKey: string
  externalId: string | null
  periodStart: Date
  periodEnd: Date
  sources: string[]
  status: ReconciliationStatus
  authoritySource: string | null
  details: {
    message: string
    recordCount?: number
  }
}

export type ReconciliationTrace = {
  recordKind: ReconciliationRecordKind
  conflictType: ReconciliationConflictType
  externalId: string | null
  periodStart: string
  periodEnd: string
  sources: string[]
  status: ReconciliationStatus
  authoritySource: string | null
  message: string
}

const SOURCE_PRIORITY = ['square', 'toast', 'quickbooks', 'manual', 'csv']

function sourceOrder(source: string) {
  const priority = SOURCE_PRIORITY.indexOf(source)
  return priority === -1 ? SOURCE_PRIORITY.length : priority
}

function sortSources(sources: Iterable<string>) {
  return [...new Set(sources)].sort(
    (left, right) =>
      sourceOrder(left) - sourceOrder(right) || left.localeCompare(right),
  )
}

function preferredSource(sources: readonly string[]) {
  return sortSources(sources)[0] ?? null
}

function isoPart(value: Date) {
  return value.toISOString()
}

function conflictKey(input: {
  recordKind: ReconciliationRecordKind
  conflictType: ReconciliationConflictType
  externalId: string | null
  periodStart: Date
  periodEnd: Date
  sources: readonly string[]
}) {
  return [
    input.recordKind,
    input.conflictType,
    input.externalId ?? '',
    isoPart(input.periodStart),
    isoPart(input.periodEnd),
    ...sortSources(input.sources),
  ].join('|')
}

function dateRange(records: readonly ReconciliationRecord[]) {
  const timestamps = records.map((record) => record.occurredAt.getTime())
  const start = Math.min(...timestamps)
  const end = Math.max(...timestamps)
  return {
    start: new Date(start),
    end: new Date(end),
  }
}

function validRecord(record: ReconciliationRecord) {
  return (
    record.source.trim() !== '' && !Number.isNaN(record.occurredAt.getTime())
  )
}

/**
 * Finds only conflicts between different sources. Same-source re-imports are
 * handled by the source + external-id database constraints and are not an
 * operator decision.
 */
export function detectReconciliationConflicts(
  input: readonly ReconciliationRecord[],
): ReconciliationConflict[] {
  const records = input.filter(validRecord)
  const conflicts = new Map<string, ReconciliationConflict>()
  const byKind = new Map<ReconciliationRecordKind, ReconciliationRecord[]>()

  for (const record of records) {
    const bucket = byKind.get(record.kind) ?? []
    bucket.push(record)
    byKind.set(record.kind, bucket)
  }

  for (const [recordKind, kindRecords] of byKind) {
    const withExternalId = new Map<string, ReconciliationRecord[]>()
    for (const record of kindRecords) {
      if (!record.externalId?.trim()) continue
      const key = record.externalId.trim()
      const bucket = withExternalId.get(key) ?? []
      bucket.push(record)
      withExternalId.set(key, bucket)
    }

    for (const [externalId, matching] of withExternalId) {
      const sources = sortSources(matching.map((record) => record.source))
      if (sources.length < 2) continue
      const range = dateRange(matching)
      const conflict: ReconciliationConflict = {
        recordKind,
        conflictType: 'external-id',
        identityKey: conflictKey({
          recordKind,
          conflictType: 'external-id',
          externalId,
          periodStart: range.start,
          periodEnd: range.end,
          sources,
        }),
        externalId,
        periodStart: range.start,
        periodEnd: range.end,
        sources,
        status: 'resolved',
        authoritySource: preferredSource(sources),
        details: {
          message:
            'The same external ID arrived from more than one source. One copy is retained for calculations.',
          recordCount: matching.length,
        },
      }
      conflicts.set(conflict.identityKey, conflict)
    }

    const bySource = new Map<string, ReconciliationRecord[]>()
    for (const record of kindRecords) {
      const bucket = bySource.get(record.source) ?? []
      bucket.push(record)
      bySource.set(record.source, bucket)
    }
    const sourceEntries = [...bySource.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
    for (let leftIndex = 0; leftIndex < sourceEntries.length; leftIndex += 1) {
      const left = sourceEntries[leftIndex]
      if (!left) continue
      const [leftSource, leftRecords] = left
      if (!leftRecords.some((record) => !record.externalId?.trim())) continue
      const leftRange = dateRange(leftRecords)
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < sourceEntries.length;
        rightIndex += 1
      ) {
        const right = sourceEntries[rightIndex]
        if (!right) continue
        const [rightSource, rightRecords] = right
        if (!rightRecords.some((record) => !record.externalId?.trim())) continue
        const rightRange = dateRange(rightRecords)
        const periodStart = new Date(
          Math.max(leftRange.start.getTime(), rightRange.start.getTime()),
        )
        const periodEnd = new Date(
          Math.min(leftRange.end.getTime(), rightRange.end.getTime()),
        )
        if (periodStart > periodEnd) continue
        const sources = sortSources([leftSource, rightSource])
        const conflict: ReconciliationConflict = {
          recordKind,
          conflictType: 'period-overlap',
          identityKey: conflictKey({
            recordKind,
            conflictType: 'period-overlap',
            externalId: null,
            periodStart,
            periodEnd,
            sources,
          }),
          externalId: null,
          periodStart,
          periodEnd,
          sources,
          status: 'unresolved',
          authoritySource: null,
          details: {
            message:
              'Sources cover the same period without stable IDs. Choose one source before these rows are used together.',
          },
        }
        conflicts.set(conflict.identityKey, conflict)
      }
    }
  }

  return [...conflicts.values()].sort(
    (left, right) =>
      left.periodStart.getTime() - right.periodStart.getTime() ||
      left.recordKind.localeCompare(right.recordKind) ||
      left.identityKey.localeCompare(right.identityKey),
  )
}

export function mergeReconciliationDecisions(
  detected: readonly ReconciliationConflict[],
  persisted: readonly ReconciliationConflict[],
) {
  const saved = new Map(
    persisted.map((conflict) => [conflict.identityKey, conflict]),
  )
  return detected.map((conflict) => {
    const prior = saved.get(conflict.identityKey)
    if (!prior) return conflict
    return {
      ...conflict,
      status: prior.status,
      authoritySource: prior.authoritySource,
      ...(prior.id ? { id: prior.id } : {}),
      ...(prior.locationId ? { locationId: prior.locationId } : {}),
    }
  })
}

export function shouldIncludeRecord(
  record: ReconciliationRecord,
  conflicts: readonly ReconciliationConflict[],
) {
  const externalConflict = conflicts.find(
    (conflict) =>
      conflict.recordKind === record.kind &&
      conflict.conflictType === 'external-id' &&
      conflict.externalId === record.externalId &&
      conflict.sources.includes(record.source),
  )
  if (externalConflict && externalConflict.authoritySource !== record.source)
    return false

  const overlapConflicts = conflicts.filter(
    (conflict) =>
      conflict.recordKind === record.kind &&
      conflict.conflictType === 'period-overlap' &&
      conflict.sources.includes(record.source) &&
      record.occurredAt >= conflict.periodStart &&
      record.occurredAt <= conflict.periodEnd,
  )
  return overlapConflicts.every(
    (conflict) =>
      conflict.status === 'resolved' &&
      conflict.authoritySource === record.source,
  )
}

export function reconciliationTrace(
  conflicts: readonly ReconciliationConflict[],
): ReconciliationTrace[] {
  return conflicts.map((conflict) => ({
    recordKind: conflict.recordKind,
    conflictType: conflict.conflictType,
    externalId: conflict.externalId,
    periodStart: conflict.periodStart.toISOString(),
    periodEnd: conflict.periodEnd.toISOString(),
    sources: conflict.sources,
    status: conflict.status,
    authoritySource: conflict.authoritySource,
    message: conflict.details.message,
  }))
}

function conflictFromRow(row: typeof reconciliationConflicts.$inferSelect) {
  return {
    id: row.id,
    locationId: row.locationId,
    recordKind: row.recordKind as ReconciliationRecordKind,
    conflictType: row.conflictType as ReconciliationConflictType,
    identityKey: row.identityKey,
    externalId: row.externalId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    sources: Array.isArray(row.sources)
      ? row.sources.filter(
          (source): source is string => typeof source === 'string',
        )
      : [],
    status: row.status as ReconciliationStatus,
    authoritySource: row.authoritySource,
    details:
      typeof row.details === 'object' && row.details !== null
        ? (row.details as ReconciliationConflict['details'])
        : { message: 'This overlap needs a source decision.' },
  } satisfies ReconciliationConflict
}

export async function listReconciliationConflicts(locationId: string) {
  const database = await getDatabase()
  const rows = await database
    .select()
    .from(reconciliationConflicts)
    .where(eq(reconciliationConflicts.locationId, locationId))
    .orderBy(
      asc(reconciliationConflicts.periodStart),
      asc(reconciliationConflicts.identityKey),
    )
  return rows.map(conflictFromRow)
}

export async function saveDetectedReconciliationConflicts(
  locationId: string,
  detected: readonly ReconciliationConflict[],
) {
  const database = await getDatabase()
  for (const conflict of detected) {
    await database
      .insert(reconciliationConflicts)
      .values({
        locationId,
        recordKind: conflict.recordKind,
        conflictType: conflict.conflictType,
        identityKey: conflict.identityKey,
        externalId: conflict.externalId,
        periodStart: conflict.periodStart,
        periodEnd: conflict.periodEnd,
        sources: conflict.sources,
        status: conflict.status,
        authoritySource: conflict.authoritySource,
        details: conflict.details,
      })
      .onConflictDoUpdate({
        target: [
          reconciliationConflicts.locationId,
          reconciliationConflicts.identityKey,
        ],
        set: {
          periodStart: conflict.periodStart,
          periodEnd: conflict.periodEnd,
          sources: conflict.sources,
          details: conflict.details,
          updatedAt: new Date(),
        },
      })
  }
  return listReconciliationConflicts(locationId)
}

export async function refreshLocationReconciliation(locationId: string) {
  const database = await getDatabase()
  const [sales, orders, snapshots] = await Promise.all([
    database
      .select({
        source: transactions.source,
        externalId: transactions.externalId,
        occurredAt: transactions.transactedAt,
      })
      .from(transactions)
      .where(eq(transactions.locationId, locationId)),
    database
      .select({
        source: purchaseOrders.source,
        externalId: purchaseOrders.externalId,
        occurredAt: purchaseOrders.orderedAt,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .where(eq(purchaseOrderItems.locationId, locationId)),
    database
      .select({
        source: inventorySnapshots.source,
        externalId: sql`null`.as<string | null>(),
        occurredAt: inventorySnapshots.countedAt,
      })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, locationId)),
  ])
  const detected = detectReconciliationConflicts([
    ...sales.map((record) => ({ ...record, kind: 'transaction' as const })),
    ...orders.map((record) => ({ ...record, kind: 'purchase_order' as const })),
    ...snapshots.map((record) => ({ ...record, kind: 'inventory' as const })),
  ])
  return saveDetectedReconciliationConflicts(locationId, detected)
}

export async function resolveReconciliationConflict(input: {
  locationId: string
  conflictId: string
  authoritySource: string
}) {
  const database = await getDatabase()
  const [existing] = await database
    .select()
    .from(reconciliationConflicts)
    .where(
      and(
        eq(reconciliationConflicts.id, input.conflictId),
        eq(reconciliationConflicts.locationId, input.locationId),
      ),
    )
    .limit(1)
  const sources = Array.isArray(existing?.sources)
    ? existing.sources.filter(
        (source): source is string => typeof source === 'string',
      )
    : []
  if (!existing || !sources.includes(input.authoritySource)) return null
  const [updated] = await database
    .update(reconciliationConflicts)
    .set({
      status: 'resolved',
      authoritySource: input.authoritySource,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reconciliationConflicts.id, input.conflictId),
        eq(reconciliationConflicts.locationId, input.locationId),
      ),
    )
    .returning()
  return updated ? conflictFromRow(updated) : null
}
