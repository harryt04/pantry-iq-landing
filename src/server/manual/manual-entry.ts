import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  csvUploadHistory,
  inventoryItems,
  inventorySnapshots,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'
import { enqueuePrecomputeForLocationInTransaction } from '@/src/server/metrics/scheduler'

export const MANUAL_ENTRY_TYPES = [
  'inventory',
  'purchase_order',
  'transaction',
] as const

export type ManualEntryType = (typeof MANUAL_ENTRY_TYPES)[number]

export class ManualEntryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManualEntryValidationError'
  }
}

type ItemSelection = {
  itemId?: string
  newItem?: {
    canonicalName: string
    displayName: string
    category?: string | null
    unit: string
  }
}

type ManualEntryInput =
  | {
      entryType: 'inventory'
      countedAt: string
      item: ItemSelection
      quantity: string
    }
  | {
      entryType: 'transaction'
      transactedAt: string
      item: ItemSelection
      quantity: string
      unitPrice: string
      totalRevenue: string
      totalCost?: string | null
    }
  | {
      entryType: 'purchase_order'
      orderedAt: string
      receivedAt?: string | null
      supplierName?: string | null
      lines: Array<{
        item: ItemSelection
        quantity: string
        unitCost: string
        totalCost: string
      }>
    }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ManualEntryValidationError('A manual entry is required.')
  }
  return input as Record<string, unknown>
}

function requiredText(
  values: Record<string, unknown>,
  field: string,
  maxLength = 255,
) {
  const value = values[field]
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new ManualEntryValidationError(`${field} is required.`)
  }
  return value.trim()
}

function optionalText(
  values: Record<string, unknown>,
  field: string,
  maxLength = 255,
) {
  if (!(field in values) || values[field] === null || values[field] === '')
    return null
  if (
    typeof values[field] !== 'string' ||
    values[field].trim().length > maxLength
  )
    throw new ManualEntryValidationError(`${field} must be readable text.`)
  return values[field].trim()
}

function decimal(
  values: Record<string, unknown>,
  field: string,
  allowZero = true,
) {
  const value = requiredText(values, field, 80)
  if (!DECIMAL_PATTERN.test(value) || (!allowZero && value === '0')) {
    throw new ManualEntryValidationError(
      `${field} must be a ${allowZero ? 'non-negative' : 'positive'} decimal.`,
    )
  }
  return value
}

function dateValue(values: Record<string, unknown>, field: string) {
  const value = requiredText(values, field, 80)
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    throw new ManualEntryValidationError(`${field} must be a readable date.`)
  return date
}

function optionalDate(values: Record<string, unknown>, field: string) {
  if (!(field in values) || values[field] === null || values[field] === '')
    return null
  return dateValue(values, field)
}

function selectionInput(value: unknown): ItemSelection {
  const values = recordInput(value)
  const itemId = values.itemId
  if (typeof itemId === 'string' && itemId.trim()) {
    if (!UUID_PATTERN.test(itemId.trim()))
      throw new ManualEntryValidationError('itemId must be a UUID.')
    return { itemId: itemId.trim() }
  }

  const newItemValues = recordInput(values.newItem)
  return {
    newItem: {
      canonicalName: requiredText(newItemValues, 'canonicalName'),
      displayName: requiredText(newItemValues, 'displayName'),
      category: optionalText(newItemValues, 'category'),
      unit: requiredText(newItemValues, 'unit', 80),
    },
  }
}

export function validateManualEntryInput(input: unknown): ManualEntryInput {
  const values = recordInput(input)
  const rawEntryType = values.entryType
  if (!MANUAL_ENTRY_TYPES.includes(rawEntryType as ManualEntryType))
    throw new ManualEntryValidationError('Choose a manual entry type.')
  const entryType = rawEntryType as ManualEntryType

  if (entryType === 'inventory') {
    return {
      entryType,
      countedAt: dateValue(values, 'countedAt').toISOString(),
      item: selectionInput(values.item),
      quantity: decimal(values, 'quantity'),
    }
  }

  if (entryType === 'transaction') {
    const totalCost =
      values.totalCost === null || values.totalCost === ''
        ? null
        : decimal(values, 'totalCost')
    return {
      entryType,
      transactedAt: dateValue(values, 'transactedAt').toISOString(),
      item: selectionInput(values.item),
      quantity: decimal(values, 'quantity', false),
      unitPrice: decimal(values, 'unitPrice'),
      totalRevenue: decimal(values, 'totalRevenue'),
      totalCost,
    }
  }

  const rawLines = values.lines
  if (
    !Array.isArray(rawLines) ||
    rawLines.length === 0 ||
    rawLines.length > 100
  )
    throw new ManualEntryValidationError(
      'Add at least one purchase-order line, and no more than 100.',
    )
  return {
    entryType,
    orderedAt: dateValue(values, 'orderedAt').toISOString(),
    receivedAt: optionalDate(values, 'receivedAt')?.toISOString() ?? null,
    supplierName: optionalText(values, 'supplierName'),
    lines: rawLines.map((line, index) => {
      const lineValues = recordInput(line)
      return {
        item: selectionInput(lineValues.item),
        quantity: decimal(lineValues, 'quantity', false),
        unitCost: decimal(lineValues, 'unitCost'),
        totalCost: decimal(lineValues, 'totalCost'),
      }
    }),
  }
}

async function resolveItem(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  locationId: string,
  selection: ItemSelection,
) {
  if (selection.itemId) {
    const [item] = await tx
      .select({
        id: inventoryItems.id,
        displayName: inventoryItems.displayName,
        isActive: inventoryItems.isActive,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, selection.itemId),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .limit(1)
    if (!item || !item.isActive)
      throw new ManualEntryValidationError(
        'Choose an active item from this location.',
      )
    return item
  }

  const newItem = selection.newItem
  if (!newItem)
    throw new ManualEntryValidationError('Choose or create an item.')
  const [existing] = await tx
    .select({
      id: inventoryItems.id,
      displayName: inventoryItems.displayName,
      isActive: inventoryItems.isActive,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.locationId, locationId),
        eq(inventoryItems.canonicalName, newItem.canonicalName),
      ),
    )
    .limit(1)
  if (existing) {
    if (!existing.isActive)
      throw new ManualEntryValidationError(
        'That item is archived. Choose an active item or use a different name.',
      )
    return existing
  }

  const [created] = await tx
    .insert(inventoryItems)
    .values({
      locationId,
      canonicalName: newItem.canonicalName,
      displayName: newItem.displayName,
      category: newItem.category,
      unit: newItem.unit,
    })
    .returning({
      id: inventoryItems.id,
      displayName: inventoryItems.displayName,
      isActive: inventoryItems.isActive,
    })
  if (!created)
    throw new ManualEntryValidationError('The new item could not be saved.')
  return created
}

export async function createManualEntry(
  headers: Headers,
  locationId: string,
  input: unknown,
) {
  const owned = await requireOwnedLocation(headers, locationId)
  const values = validateManualEntryInput(input)

  return db.transaction(async (tx) => {
    let rowsImported = 1
    let entryLabel = 'Manual entry'

    if (values.entryType === 'inventory') {
      const item = await resolveItem(tx, owned.locationId, values.item)
      await tx.insert(inventorySnapshots).values({
        locationId: owned.locationId,
        inventoryItemId: item.id,
        countedAt: new Date(values.countedAt),
        qty: values.quantity,
        source: 'manual',
      })
      entryLabel = 'Manual inventory count'
    } else if (values.entryType === 'transaction') {
      const item = await resolveItem(tx, owned.locationId, values.item)
      await tx.insert(transactions).values({
        locationId: owned.locationId,
        transactedAt: new Date(values.transactedAt),
        externalId: `manual-${randomUUID()}`,
        source: 'manual',
        menuItemId: item.id,
        rawItemName: item.displayName,
        qty: values.quantity,
        unitPrice: values.unitPrice,
        totalRevenue: values.totalRevenue,
        totalCost: values.totalCost,
        grossMargin: null,
      })
      await tx
        .update(inventoryItems)
        .set({
          usageCount: sql`${inventoryItems.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryItems.id, item.id),
            eq(inventoryItems.locationId, owned.locationId),
          ),
        )
      entryLabel = 'Manual transaction'
    } else {
      const order = await tx
        .insert(purchaseOrders)
        .values({
          locationId: owned.locationId,
          orderedAt: new Date(values.orderedAt),
          receivedAt: values.receivedAt ? new Date(values.receivedAt) : null,
          externalId: `manual-${randomUUID()}`,
          source: 'manual',
          supplierName: values.supplierName,
        })
        .returning({ id: purchaseOrders.id })
      const orderId = order[0]?.id
      if (!orderId)
        throw new ManualEntryValidationError(
          'The purchase order could not be saved.',
        )
      for (const line of values.lines) {
        const item = await resolveItem(tx, owned.locationId, line.item)
        await tx.insert(purchaseOrderItems).values({
          purchaseOrderId: orderId,
          locationId: owned.locationId,
          inventoryItemId: item.id,
          rawItemName: item.displayName,
          qty: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.totalCost,
        })
        await tx
          .update(inventoryItems)
          .set({
            usageCount: sql`${inventoryItems.usageCount} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventoryItems.id, item.id),
              eq(inventoryItems.locationId, owned.locationId),
            ),
          )
      }
      rowsImported = values.lines.length
      entryLabel = 'Manual purchase order'
    }

    const [history] = await tx
      .insert(csvUploadHistory)
      .values({
        locationId: owned.locationId,
        filename: entryLabel,
        source: 'manual',
        rowsImported,
        mappingUsed: { entryType: values.entryType, source: 'manual' },
        unmatchedItems: [],
        storageKey: null,
        status: 'imported',
        uploadedAt: new Date(),
      })
      .returning({ id: csvUploadHistory.id })

    await enqueuePrecomputeForLocationInTransaction(tx, owned.locationId)

    return { entryType: values.entryType, rowsImported, historyId: history?.id }
  })
}
