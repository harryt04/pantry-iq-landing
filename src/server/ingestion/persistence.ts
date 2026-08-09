import { and, eq } from 'drizzle-orm'

import type { db } from '@/src/server/db/client'
import {
  csvUploadHistory,
  inventorySnapshots,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'

import type { NormalizedIngestionRecord } from './records'

type IngestionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type PersistedIngestionResult = {
  rowsImported: number
  usage: Map<string, number>
}

export type IngestionHistoryInput = {
  locationId: string
  filename: string
  source: string
  rowsImported: number
  mappingUsed: unknown
  itemResolution?: unknown
  unmatchedItems?: unknown
  storageKey?: string | null
  status?: 'uploaded' | 'imported'
  uploadedAt?: Date
}

/** Keep audit history source-independent even though the legacy table retains its name. */
export async function createIngestionHistory(
  tx: IngestionTransaction,
  input: IngestionHistoryInput,
) {
  const [history] = await tx
    .insert(csvUploadHistory)
    .values({
      locationId: input.locationId,
      filename: input.filename,
      source: input.source,
      rowsImported: input.rowsImported,
      mappingUsed: input.mappingUsed,
      itemResolution: input.itemResolution,
      unmatchedItems: input.unmatchedItems,
      storageKey: input.storageKey,
      status: input.status ?? 'imported',
      uploadedAt: input.uploadedAt ?? new Date(),
    })
    .returning({ id: csvUploadHistory.id })
  return history
}

export async function finalizeIngestionHistory(
  tx: IngestionTransaction,
  input: {
    id: string
    locationId: string
    rowsImported: number
    itemResolution: unknown
    unmatchedItems: unknown
  },
) {
  await tx
    .update(csvUploadHistory)
    .set({
      rowsImported: input.rowsImported,
      itemResolution: input.itemResolution,
      unmatchedItems: input.unmatchedItems,
      status: 'imported',
    })
    .where(
      and(
        eq(csvUploadHistory.id, input.id),
        eq(csvUploadHistory.locationId, input.locationId),
        eq(csvUploadHistory.status, 'uploaded'),
      ),
    )
}

/**
 * Persist normalized records for any source. Conflict handling deliberately
 * lives here so CSV, manual entry, and future connectors share the same
 * source + external-id boundary.
 */
export async function persistNormalizedRecords(
  tx: IngestionTransaction,
  locationId: string,
  records: readonly NormalizedIngestionRecord[],
): Promise<PersistedIngestionResult> {
  const usage = new Map<string, number>()
  let rowsImported = 0

  const transactionsToInsert = records.filter(
    (
      record,
    ): record is Extract<NormalizedIngestionRecord, { kind: 'transaction' }> =>
      record.kind === 'transaction',
  )
  if (transactionsToInsert.length) {
    const inserted = await tx
      .insert(transactions)
      .values(
        transactionsToInsert.map((record) => ({
          locationId,
          transactedAt: record.transactedAt,
          externalId: record.externalId,
          source: record.source,
          menuItemId: record.itemId,
          rawItemName: record.rawItemName,
          category: record.category,
          qty: record.qty,
          unitPrice: record.unitPrice,
          totalRevenue: record.totalRevenue,
          totalCost: record.totalCost,
          grossMargin: record.grossMargin,
        })),
      )
      .onConflictDoNothing()
      .returning({ menuItemId: transactions.menuItemId })
    rowsImported += inserted.length
    for (const row of inserted) {
      if (row.menuItemId)
        usage.set(row.menuItemId, (usage.get(row.menuItemId) ?? 0) + 1)
    }
  }

  const purchaseOrdersToInsert = records.filter(
    (
      record,
    ): record is Extract<
      NormalizedIngestionRecord,
      { kind: 'purchase_order' }
    > => record.kind === 'purchase_order',
  )
  for (const record of purchaseOrdersToInsert) {
    const [existing] = await tx
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.locationId, locationId),
          eq(purchaseOrders.source, record.source),
          eq(purchaseOrders.externalId, record.externalId),
        ),
      )
      .limit(1)
    if (existing) continue

    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        locationId,
        orderedAt: record.orderedAt,
        receivedAt: record.receivedAt,
        externalId: record.externalId,
        source: record.source,
        supplierName: record.supplierName,
      })
      .returning({ id: purchaseOrders.id })
    if (!order) continue

    const insertedLines = await tx
      .insert(purchaseOrderItems)
      .values(
        record.lines.map((line) => ({
          purchaseOrderId: order.id,
          locationId,
          inventoryItemId: line.itemId,
          rawItemName: line.rawItemName,
          qty: line.qty,
          unitCost: line.unitCost,
          totalCost: line.totalCost,
        })),
      )
      .returning({ inventoryItemId: purchaseOrderItems.inventoryItemId })
    rowsImported += insertedLines.length
    for (const row of insertedLines) {
      if (row.inventoryItemId)
        usage.set(
          row.inventoryItemId,
          (usage.get(row.inventoryItemId) ?? 0) + 1,
        )
    }
  }

  const inventoryToInsert = records.filter(
    (
      record,
    ): record is Extract<NormalizedIngestionRecord, { kind: 'inventory' }> =>
      record.kind === 'inventory',
  )
  if (inventoryToInsert.length) {
    const existing = await tx
      .select({
        inventoryItemId: inventorySnapshots.inventoryItemId,
        countedAt: inventorySnapshots.countedAt,
        qty: inventorySnapshots.qty,
        source: inventorySnapshots.source,
      })
      .from(inventorySnapshots)
      .where(eq(inventorySnapshots.locationId, locationId))
    const existingKeys = new Set(
      existing.map(
        (row) =>
          `${row.inventoryItemId}|${row.countedAt.toISOString()}|${row.qty}|${row.source}`,
      ),
    )
    const values = inventoryToInsert.flatMap((record) => {
      const value = {
        locationId,
        inventoryItemId: record.itemId,
        countedAt: record.countedAt,
        qty: record.qty,
        source: record.source,
      }
      const key = `${value.inventoryItemId}|${value.countedAt.toISOString()}|${value.qty}|${value.source}`
      if (existingKeys.has(key)) return []
      existingKeys.add(key)
      return [value]
    })
    if (values.length) {
      const inserted = await tx
        .insert(inventorySnapshots)
        .values(values)
        .returning({ id: inventorySnapshots.id })
      rowsImported += inserted.length
    }
  }

  return { rowsImported, usage }
}
