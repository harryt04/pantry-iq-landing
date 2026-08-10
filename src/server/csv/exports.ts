import { and, asc, eq } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  inventorySnapshots,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from '@/src/server/db/schema'

import { csvExportDocument, type CsvExportType } from './export-format'

export {
  CSV_EXPORT_TYPES,
  csvExportDocument,
  isCsvExportType,
  type CsvExportType,
} from './export-format'

export async function exportLocationCsv(
  headers: Headers,
  locationId: string,
  type: CsvExportType,
) {
  const owned = await requireOwnedLocation(headers, locationId)

  if (type === 'transactions') {
    const rows = await db
      .select({
        transactedAt: transactions.transactedAt,
        externalId: transactions.externalId,
        rawItemName: transactions.rawItemName,
        category: transactions.category,
        qty: transactions.qty,
        unitPrice: transactions.unitPrice,
        totalRevenue: transactions.totalRevenue,
        totalCost: transactions.totalCost,
        grossMargin: transactions.grossMargin,
      })
      .from(transactions)
      .where(eq(transactions.locationId, owned.locationId))
      .orderBy(asc(transactions.transactedAt), asc(transactions.id))

    return csvExportDocument(
      type,
      rows.map((row) => [
        row.transactedAt,
        row.externalId,
        row.rawItemName,
        row.category,
        row.qty,
        row.unitPrice,
        row.totalRevenue,
        row.totalCost,
        row.grossMargin,
      ]),
    )
  }

  if (type === 'purchase_orders') {
    const rows = await db
      .select({
        orderId: purchaseOrders.id,
        orderedAt: purchaseOrders.orderedAt,
        receivedAt: purchaseOrders.receivedAt,
        externalId: purchaseOrders.externalId,
        supplierName: purchaseOrders.supplierName,
        rawItemName: purchaseOrderItems.rawItemName,
        itemDisplayName: inventoryItems.displayName,
        qty: purchaseOrderItems.qty,
        unitCost: purchaseOrderItems.unitCost,
        totalCost: purchaseOrderItems.totalCost,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.id, purchaseOrderItems.inventoryItemId),
      )
      .where(eq(purchaseOrders.locationId, owned.locationId))
      .orderBy(
        asc(purchaseOrders.orderedAt),
        asc(purchaseOrders.id),
        asc(purchaseOrderItems.id),
      )

    return csvExportDocument(
      type,
      rows.map((row) => [
        row.orderedAt,
        row.receivedAt,
        // A stable fallback keeps null-externalId orders grouped on re-import.
        row.externalId ?? row.orderId,
        row.supplierName,
        row.itemDisplayName ?? row.rawItemName,
        row.qty,
        row.unitCost,
        row.totalCost,
      ]),
    )
  }

  if (type === 'inventory_items') {
    const rows = await db
      .select({
        id: inventoryItems.id,
        canonicalName: inventoryItems.canonicalName,
        displayName: inventoryItems.displayName,
        category: inventoryItems.category,
        unit: inventoryItems.unit,
        itemType: inventoryItems.itemType,
        shelfLifeDays: inventoryItems.shelfLifeDays,
        costPerUnit: inventoryItems.costPerUnit,
        menuPrice: inventoryItems.menuPrice,
        parLevel: inventoryItems.parLevel,
        isActive: inventoryItems.isActive,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.locationId, owned.locationId))
      .orderBy(asc(inventoryItems.displayName), asc(inventoryItems.id))

    return csvExportDocument(
      type,
      rows.map((row) => [
        row.id,
        row.canonicalName,
        row.displayName,
        row.category,
        row.unit,
        row.itemType,
        row.shelfLifeDays,
        row.costPerUnit,
        row.menuPrice,
        row.parLevel,
        row.isActive ? 'true' : 'false',
      ]),
    )
  }

  const rows = await db
    .select({
      snapshotId: inventorySnapshots.id,
      countedAt: inventorySnapshots.countedAt,
      rawItemName: inventoryItems.displayName,
      category: inventoryItems.category,
      unit: inventoryItems.unit,
      shelfLifeDays: inventoryItems.shelfLifeDays,
      qty: inventorySnapshots.qty,
    })
    .from(inventorySnapshots)
    .innerJoin(
      inventoryItems,
      and(
        eq(inventoryItems.id, inventorySnapshots.inventoryItemId),
        eq(inventoryItems.locationId, owned.locationId),
      ),
    )
    .where(eq(inventorySnapshots.locationId, owned.locationId))
    .orderBy(asc(inventorySnapshots.countedAt), asc(inventorySnapshots.id))

  return csvExportDocument(
    type,
    rows.map((row) => [
      row.countedAt,
      row.snapshotId,
      row.rawItemName,
      row.qty,
      row.category,
      row.unit,
      row.shelfLifeDays,
    ]),
  )
}
