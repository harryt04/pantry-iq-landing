import { and, asc, desc, eq, sql } from 'drizzle-orm'

import {
  requireOwnedLocation,
  requireSession,
} from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  csvUploadHistory,
  inventoryItems,
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
import {
  normalizeInventoryCount,
  normalizeLaborShift,
  normalizePurchaseOrder,
  normalizeTransaction,
} from '@/src/server/ingestion/records'
import { persistNormalizedRecords } from '@/src/server/ingestion/persistence'
import { finalizeIngestionHistory } from '@/src/server/ingestion/persistence'
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
  if (!planItem) return undefined
  return planItem.kind === 'existing' ? planItem.id : created.get(planItem.key)
}

function itemResolutionForPlan(
  plan: ImportPlan,
  created: ReadonlyMap<string, string>,
): ImportItemResolutionAudit {
  const createdItems = new Map<string, ImportHistoryItem>()
  const matchedItems = new Map<string, ImportHistoryItem>()

  for (const row of plan.rows) {
    if (!row.item) continue
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

    const normalized = []
    if (upload.source === 'transactions') {
      normalized.push(
        ...plan.rows.map((row) =>
          normalizeTransaction({
            transactedAt: row.values.transactedAt as Date,
            externalId: row.values.externalId as string,
            source: 'csv',
            itemId: idFor(row.item, created) as string,
            rawItemName: row.rawItemName,
            category: row.values.category as string | null,
            qty: row.values.qty as string,
            unitPrice: row.values.unitPrice as string,
            totalRevenue: row.values.totalRevenue as string,
            totalCost: row.values.totalCost as string | null,
            grossMargin: row.values.grossMargin as string | null,
          }),
        ),
      )
    } else if (upload.source === 'purchase_orders') {
      const groups = new Map<string, ImportPlan['rows']>()
      for (const row of plan.rows) {
        const key = row.values.externalId as string
        groups.set(key, [...(groups.get(key) ?? []), row])
      }
      normalized.push(
        ...[...groups.entries()].map(([externalId, rows]) => {
          const first = rows[0]
          if (!first) throw new Error('A purchase order row is required.')
          return normalizePurchaseOrder({
            source: 'csv',
            externalId,
            orderedAt: first.values.orderedAt as Date,
            receivedAt: first.values.receivedAt as Date | null,
            supplierName: first.values.supplierName as string | null,
            lines: rows.map((row) => ({
              itemId: idFor(row.item, created) as string,
              rawItemName: row.rawItemName,
              qty: row.values.qty as string,
              unitCost: row.values.unitCost as string,
              totalCost: row.values.totalCost as string,
            })),
          })
        }),
      )
    } else if (upload.source === 'inventory') {
      normalized.push(
        ...plan.rows.map((row) =>
          normalizeInventoryCount({
            source: 'csv',
            externalId: null,
            countedAt: row.values.countedAt as Date,
            itemId: idFor(row.item, created) as string,
            qty: row.values.qty as string,
          }),
        ),
      )
    } else {
      normalized.push(
        ...plan.rows.map((row) =>
          normalizeLaborShift({
            source: 'csv',
            externalId: row.values.externalId as string,
            shiftStart: row.values.shiftStart as Date,
            shiftEnd: row.values.shiftEnd as Date | null,
            employeeReference: row.values.employeeReference as string | null,
            role: row.values.role as string,
            scheduledHours: row.values.scheduledHours as string | null,
            actualHours: row.values.actualHours as string | null,
            laborCost: row.values.laborCost as string | null,
          }),
        ),
      )
    }

    const { rowsImported, usage } = await persistNormalizedRecords(
      tx,
      upload.locationId,
      normalized,
    )

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

    await finalizeIngestionHistory(tx, {
      id: upload.id,
      locationId: upload.locationId,
      rowsImported,
      itemResolution,
      unmatchedItems: [],
    })

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
