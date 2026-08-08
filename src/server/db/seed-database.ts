import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import {
  csvUploadHistory,
  inventoryItems,
  inventorySnapshots,
  locations,
  purchaseOrderItems,
  purchaseOrders,
  transactions,
} from './schema'

// Stable IDs make the seed safe to run repeatedly and easy to identify in a
// local database. The owner UUID is intentionally not a real account: FND-05
// will replace it with a Better Auth user when authentication is available.
const seedOwnerId = '00000000-0000-4000-8000-000000000001'
const seedLocationId = '00000000-0000-4000-8000-000000000002'
const seedItemId = '00000000-0000-4000-8000-000000000003'
const seedPurchaseOrderId = '00000000-0000-4000-8000-000000000004'
const seedUploadId = '00000000-0000-4000-8000-000000000005'

export const seedDatabase = async (client: ReturnType<typeof postgres>) => {
  const db = drizzle(client)

  await db.transaction(async (tx) => {
    await tx
      .insert(locations)
      .values({
        id: seedLocationId,
        userId: seedOwnerId,
        name: 'Seed location',
        address: '100 Example Street',
        timezone: 'America/Denver',
        businessDayBoundary: '04:00:00',
      })
      .onConflictDoNothing({ target: locations.id })

    await tx
      .insert(inventoryItems)
      .values({
        id: seedItemId,
        locationId: seedLocationId,
        canonicalName: 'salmon fillet',
        displayName: 'Salmon fillet',
        category: 'seafood',
        unit: 'lb',
        shelfLifeDays: 3,
        costPerUnit: '8.50',
        parLevel: '40.00',
      })
      .onConflictDoNothing({ target: inventoryItems.id })

    const transactionRows = Array.from({ length: 35 }, (_, day) => ({
      id: `00000000-0000-4000-8000-${String(day + 100).padStart(12, '0')}`,
      locationId: seedLocationId,
      transactedAt: new Date(Date.UTC(2026, 6, 1 + day, 18)),
      externalId: `seed-sale-${day + 1}`,
      source: 'seed',
      menuItemId: seedItemId,
      rawItemName: 'Salmon fillet',
      category: 'seafood',
      qty: String(4 + (day % 3)),
      unitPrice: '18.00',
      totalRevenue: String((4 + (day % 3)) * 18),
      totalCost: String((4 + (day % 3)) * 8.5),
      grossMargin: String((4 + (day % 3)) * 9.5),
    }))

    await tx
      .insert(transactions)
      .values(transactionRows)
      .onConflictDoNothing({
        target: [
          transactions.locationId,
          transactions.source,
          transactions.externalId,
        ],
      })

    await tx
      .insert(purchaseOrders)
      .values({
        id: seedPurchaseOrderId,
        locationId: seedLocationId,
        orderedAt: new Date(Date.UTC(2026, 6, 1, 15)),
        receivedAt: new Date(Date.UTC(2026, 6, 1, 17)),
        externalId: 'seed-po-1',
        source: 'seed',
        supplierName: 'Seed supplier',
      })
      .onConflictDoNothing({ target: purchaseOrders.id })

    await tx
      .insert(purchaseOrderItems)
      .values({
        id: '00000000-0000-4000-8000-000000000006',
        purchaseOrderId: seedPurchaseOrderId,
        locationId: seedLocationId,
        inventoryItemId: seedItemId,
        rawItemName: 'Salmon fillet',
        qty: '100.00',
        unitCost: '8.50',
        totalCost: '850.00',
      })
      .onConflictDoNothing({ target: purchaseOrderItems.id })

    await tx
      .insert(inventorySnapshots)
      .values({
        id: '00000000-0000-4000-8000-000000000007',
        locationId: seedLocationId,
        inventoryItemId: seedItemId,
        countedAt: new Date(Date.UTC(2026, 7, 4, 16)),
        qty: '12.00',
        source: 'seed',
      })
      .onConflictDoNothing({ target: inventorySnapshots.id })

    await tx
      .insert(csvUploadHistory)
      .values({
        id: seedUploadId,
        locationId: seedLocationId,
        filename: 'seed-sales.csv',
        source: 'transactions',
        rowsImported: transactionRows.length,
        mappingUsed: {
          date: 'transactedAt',
          item: 'rawItemName',
          quantity: 'qty',
          revenue: 'totalRevenue',
        },
        uploadedAt: new Date(Date.UTC(2026, 7, 4, 16)),
      })
      .onConflictDoNothing({ target: csvUploadHistory.id })
  })
}
