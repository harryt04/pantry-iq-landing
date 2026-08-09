import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import {
  requireOwnedLocation,
  requireSession,
} from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  csvUploadHistory,
  inventoryItems,
  inventorySnapshots,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
  locations,
} from '@/src/server/db/schema'
import {
  createConfiguredObjectStorage,
  type ObjectStorage,
} from '@/src/server/storage/object-storage'

import {
  buildCsvImportPlan,
  type ImportItemResolution,
  type ImportPlan,
} from './import-plan'
import { parseStoredCsvMapping } from './mapping'
import { parseCsvRows } from './parser'
import { CSV_IMPORT_TYPES, type CsvImportType } from './upload-input'
import type { ItemResolutionCandidate } from './item-resolution'
import { enqueuePrecomputeForLocationInTransaction } from '@/src/server/metrics/scheduler'
import type {
  ImportHistoryItem,
  ImportItemResolutionAudit,
} from './import-history'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class CsvImportNotFoundError extends Error {
  constructor() {
    super('That upload is not available to this account.')
    this.name = 'CsvImportNotFoundError'
  }
}

export class CsvImportUnresolvedError extends Error {
  readonly plan: ImportPlan

  constructor(plan: ImportPlan) {
    super('Resolve every item name before importing.')
    this.name = 'CsvImportUnresolvedError'
    this.plan = plan
  }
}

export type ImportSummary = {
  uploadId: string
  filename: string
  importType: CsvImportType
  rowsToImport: number
  rowsImported: number
  newItems: number
  linkedItems: number
  alreadyImported: boolean
  ready: boolean
  unmatchedItems: ImportPlan['unmatchedItems']
  items: ItemResolutionCandidate[]
}

async function uploadForSession(headers: Headers, uploadId: string) {
  const session = await requireSession(headers)
  if (!UUID_PATTERN.test(uploadId)) throw new CsvImportNotFoundError()
  const [upload] = await db
    .select({
      id: csvUploadHistory.id,
      locationId: csvUploadHistory.locationId,
      filename: csvUploadHistory.filename,
      source: csvUploadHistory.source,
      mappingUsed: csvUploadHistory.mappingUsed,
      storageKey: csvUploadHistory.storageKey,
      status: csvUploadHistory.status,
      rowsImported: csvUploadHistory.rowsImported,
    })
    .from(csvUploadHistory)
    .innerJoin(locations, eq(locations.id, csvUploadHistory.locationId))
    .where(
      and(
        eq(csvUploadHistory.id, uploadId),
        eq(locations.userId, session.user.id),
      ),
    )
    .limit(1)
  if (!upload?.storageKey || !isImportType(upload.source))
    throw new CsvImportNotFoundError()
  return {
    ...upload,
    source: upload.source as CsvImportType,
    storageKey: upload.storageKey,
  }
}

function isImportType(value: string): value is CsvImportType {
  return (CSV_IMPORT_TYPES as readonly string[]).includes(value)
}

async function itemCandidates(
  locationId: string,
): Promise<ItemResolutionCandidate[]> {
  return db
    .select({
      id: inventoryItems.id,
      canonicalName: inventoryItems.canonicalName,
      displayName: inventoryItems.displayName,
      category: inventoryItems.category,
      unit: inventoryItems.unit,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.locationId, locationId))
    .orderBy(asc(inventoryItems.displayName), asc(inventoryItems.id))
}

async function importPlanFor(
  headers: Headers,
  uploadId: string,
  resolutions: Readonly<Record<string, ImportItemResolution>> | undefined,
  storage?: ObjectStorage,
) {
  const upload = await uploadForSession(headers, uploadId)
  const importType = upload.source
  const mapping = parseStoredCsvMapping(upload.mappingUsed, importType)
  if (!mapping) throw new CsvImportNotFoundError()
  const objectStorage = storage ?? createConfiguredObjectStorage()
  const csv = await parseCsvRows(
    await objectStorage.getObject(upload.storageKey),
  )
  const plan = buildCsvImportPlan({
    csv,
    importType,
    mapping,
    items: await itemCandidates(upload.locationId),
    ...(resolutions ? { resolutions } : {}),
  })
  return { upload, plan }
}

function summaryFor(
  upload: Awaited<ReturnType<typeof uploadForSession>>,
  plan: ImportPlan,
  overrides: Partial<
    Pick<ImportSummary, 'rowsImported' | 'alreadyImported'>
  > = {},
): ImportSummary {
  return {
    uploadId: upload.id,
    filename: upload.filename,
    importType: upload.source,
    rowsToImport: plan.rows.length,
    rowsImported: overrides.rowsImported ?? 0,
    newItems: plan.newItems.length,
    linkedItems: plan.linkedItemCount,
    alreadyImported: overrides.alreadyImported ?? false,
    ready: plan.unmatchedItems.length === 0,
    unmatchedItems: plan.unmatchedItems,
    items: plan.items,
  }
}

export async function previewCsvImport(
  headers: Headers,
  uploadId: string,
  resolutions?: Readonly<Record<string, ImportItemResolution>>,
  storage?: ObjectStorage,
) {
  const { upload, plan } = await importPlanFor(
    headers,
    uploadId,
    resolutions,
    storage,
  )
  if (upload.status === 'imported') {
    return summaryFor(upload, plan, {
      rowsImported: upload.rowsImported,
      alreadyImported: true,
    })
  }
  return summaryFor(upload, plan)
}

function idFor(
  planItem: ImportPlan['rows'][number]['item'],
  created: Map<string, string>,
) {
  return planItem.kind === 'existing' ? planItem.id : created.get(planItem.key)
}

function itemResolutionForPlan(
  plan: ImportPlan,
  created: ReadonlyMap<string, string>,
): ImportItemResolutionAudit {
  const createdItems = new Map<string, ImportHistoryItem>()
  const matchedItems = new Map<string, ImportHistoryItem>()

  for (const row of plan.rows) {
    if (row.item.kind === 'new') {
      const id = created.get(row.item.key)
      if (id)
        createdItems.set(row.item.key, {
          id,
          canonicalName: row.item.input.canonicalName.trim(),
          displayName: row.item.input.displayName.trim(),
        })
      continue
    }
    if (row.item.kind !== 'existing') continue
    const existingItem = row.item as Extract<
      ImportPlan['rows'][number]['item'],
      { kind: 'existing' }
    >
    const item = plan.items.find(
      (candidate) => candidate.id === existingItem.id,
    )
    if (item)
      matchedItems.set(item.id, {
        id: item.id,
        canonicalName: item.canonicalName,
        displayName: item.displayName,
      })
  }

  return {
    created: [...createdItems.values()].sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    ),
    matched: [...matchedItems.values()].sort((a, b) =>
      a.canonicalName.localeCompare(b.canonicalName),
    ),
  }
}

export async function commitCsvImport(
  headers: Headers,
  uploadId: string,
  resolutions?: Readonly<Record<string, ImportItemResolution>>,
  storage?: ObjectStorage,
) {
  const { upload, plan } = await importPlanFor(
    headers,
    uploadId,
    resolutions,
    storage,
  )
  if (upload.status === 'imported')
    return summaryFor(upload, plan, {
      rowsImported: upload.rowsImported,
      alreadyImported: true,
    })
  if (plan.unmatchedItems.length > 0) throw new CsvImportUnresolvedError(plan)

  return db.transaction(async (tx) => {
    const created = new Map<string, string>()
    if (plan.newItems.length > 0) {
      const inserted = await tx
        .insert(inventoryItems)
        .values(
          plan.newItems.map((item) => ({
            locationId: upload.locationId,
            canonicalName: item.input.canonicalName.trim(),
            displayName: item.input.displayName.trim(),
            category: item.input.category,
            unit: item.input.unit.trim(),
            shelfLifeDays: item.input.shelfLifeDays,
          })),
        )
        .returning({
          id: inventoryItems.id,
          canonicalName: inventoryItems.canonicalName,
        })
      for (const item of inserted) {
        const planned = plan.newItems.find(
          (candidate) =>
            candidate.input.canonicalName.trim() === item.canonicalName,
        )
        if (planned) created.set(planned.key, item.id)
      }
    }

    let rowsImported = 0
    const usage = new Map<string, number>()
    if (upload.source === 'transactions') {
      const inserted = await tx
        .insert(transactions)
        .values(
          plan.rows.map((row) => ({
            locationId: upload.locationId,
            transactedAt: row.values.transactedAt as Date,
            externalId: row.values.externalId as string,
            source: 'csv',
            menuItemId: idFor(row.item, created) ?? null,
            rawItemName: row.rawItemName,
            category: row.values.category as string | null,
            qty: row.values.qty as string,
            unitPrice: row.values.unitPrice as string,
            totalRevenue: row.values.totalRevenue as string,
            totalCost: row.values.totalCost as string | null,
            grossMargin: row.values.grossMargin as string | null,
          })),
        )
        .onConflictDoNothing()
        .returning({ menuItemId: transactions.menuItemId })
      rowsImported = inserted.length
      for (const row of inserted) {
        if (row.menuItemId)
          usage.set(row.menuItemId, (usage.get(row.menuItemId) ?? 0) + 1)
      }
    } else if (upload.source === 'purchase_orders') {
      const groups = new Map<string, ImportPlan['rows']>()
      for (const row of plan.rows) {
        const key = row.values.externalId as string
        groups.set(key, [...(groups.get(key) ?? []), row])
      }
      const keys = [...groups.keys()]
      const existing = await tx
        .select({
          id: purchaseOrders.id,
          externalId: purchaseOrders.externalId,
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.locationId, upload.locationId),
            eq(purchaseOrders.source, 'csv'),
            inArray(purchaseOrders.externalId, keys),
          ),
        )
      const existingKeys = new Set(
        existing.map((row) => row.externalId).filter(Boolean),
      )
      const freshGroups = keys.filter((key) => !existingKeys.has(key))
      const insertedOrders = await tx
        .insert(purchaseOrders)
        .values(
          freshGroups.map((key) => {
            const row = groups.get(key)?.[0]
            return {
              locationId: upload.locationId,
              orderedAt: row?.values.orderedAt as Date,
              receivedAt: row?.values.receivedAt as Date | null,
              externalId: key,
              source: 'csv',
              supplierName: row?.values.supplierName as string | null,
            }
          }),
        )
        .returning({
          id: purchaseOrders.id,
          externalId: purchaseOrders.externalId,
        })
      const orderIds = new Map(
        insertedOrders.map((row) => [row.externalId, row.id]),
      )
      const lines = freshGroups.flatMap((key) =>
        (groups.get(key) ?? []).map((row) => ({
          purchaseOrderId: orderIds.get(key) as string,
          locationId: upload.locationId,
          inventoryItemId: idFor(row.item, created) ?? null,
          rawItemName: row.rawItemName,
          qty: row.values.qty as string,
          unitCost: row.values.unitCost as string,
          totalCost: row.values.totalCost as string,
        })),
      )
      const insertedLines = lines.length
        ? await tx
            .insert(purchaseOrderItems)
            .values(lines)
            .returning({ inventoryItemId: purchaseOrderItems.inventoryItemId })
        : []
      rowsImported = insertedLines.length
      for (const row of insertedLines) {
        if (row.inventoryItemId)
          usage.set(
            row.inventoryItemId,
            (usage.get(row.inventoryItemId) ?? 0) + 1,
          )
      }
    } else {
      const existing = await tx
        .select({
          inventoryItemId: inventorySnapshots.inventoryItemId,
          countedAt: inventorySnapshots.countedAt,
          qty: inventorySnapshots.qty,
        })
        .from(inventorySnapshots)
        .where(
          and(
            eq(inventorySnapshots.locationId, upload.locationId),
            eq(inventorySnapshots.source, 'csv'),
          ),
        )
      const existingKeys = new Set(
        existing.map(
          (row) =>
            `${row.inventoryItemId}|${row.countedAt.toISOString()}|${row.qty}`,
        ),
      )
      const values = plan.rows.flatMap((row) => {
        const inventoryItemId = idFor(row.item, created)
        if (!inventoryItemId) return []
        const value = {
          locationId: upload.locationId,
          inventoryItemId,
          countedAt: row.values.countedAt as Date,
          qty: row.values.qty as string,
          source: 'csv',
        }
        const key = `${inventoryItemId}|${value.countedAt.toISOString()}|${value.qty}`
        if (existingKeys.has(key)) return []
        existingKeys.add(key)
        return [value]
      })
      if (values.length) {
        const inserted = await tx
          .insert(inventorySnapshots)
          .values(values)
          .returning({ id: inventorySnapshots.id })
        rowsImported = inserted.length
      }
    }

    for (const [itemId, amount] of usage) {
      await tx
        .update(inventoryItems)
        .set({
          usageCount: sql`${inventoryItems.usageCount} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryItems.id, itemId),
            eq(inventoryItems.locationId, upload.locationId),
          ),
        )
    }

    const itemResolution = itemResolutionForPlan(plan, created)

    await tx
      .update(csvUploadHistory)
      .set({
        rowsImported,
        itemResolution,
        unmatchedItems: [],
        status: 'imported',
      })
      .where(
        and(
          eq(csvUploadHistory.id, upload.id),
          eq(csvUploadHistory.locationId, upload.locationId),
          eq(csvUploadHistory.status, 'uploaded'),
        ),
      )

    await enqueuePrecomputeForLocationInTransaction(tx, upload.locationId)

    return summaryFor(upload, plan, { rowsImported })
  })
}

export async function listImportHistory(headers: Headers, locationId: string) {
  const owned = await requireOwnedLocation(headers, locationId)
  return db
    .select({
      id: csvUploadHistory.id,
      filename: csvUploadHistory.filename,
      importType: csvUploadHistory.source,
      rowsImported: csvUploadHistory.rowsImported,
      status: csvUploadHistory.status,
      uploadedAt: csvUploadHistory.uploadedAt,
      mappingUsed: csvUploadHistory.mappingUsed,
      itemResolution: csvUploadHistory.itemResolution,
    })
    .from(csvUploadHistory)
    .where(eq(csvUploadHistory.locationId, owned.locationId))
    .orderBy(desc(csvUploadHistory.uploadedAt), desc(csvUploadHistory.id))
}
