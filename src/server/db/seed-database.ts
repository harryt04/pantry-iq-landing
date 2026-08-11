import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

import {
  csvUploadHistory,
  inventoryItems,
  inventorySnapshots,
  locations,
  purchaseOrderItems,
  purchaseOrders,
  user,
  transactions,
} from './schema'

// Stable IDs make the seed safe to run repeatedly and easy to identify in a
// local database. The seed owner is an identity row for foreign-key fixtures,
// not a usable login account.
const seedOwnerId = '00000000-0000-4000-8000-000000000001'
const seedLocationId = '00000000-0000-4000-8000-000000000002'
const seedItemId = '00000000-0000-4000-8000-000000000003'
const seedPurchaseOrderId = '00000000-0000-4000-8000-000000000004'
const seedUploadId = '00000000-0000-4000-8000-000000000005'

export type SeedLocationFixture = {
  inventorySnapshots: readonly {
    countedAt: string
    externalId: string
    itemName: string
    qty: string
  }[]
  locationId: string
  sales: readonly {
    externalId: string
    itemName: string
    qty: string
    totalRevenue: string
    transactedAt: string
  }[]
}

export type SeedDatabaseOptions = {
  fixtureLocations?: readonly SeedLocationFixture[]
  ownerId?: string
}

function divideDecimalByInteger(value: string, divisor: string) {
  const [integer = '0', fraction = ''] = value.split('.')
  const coefficient = BigInt(`${integer}${fraction}` || '0')
  const divisorCoefficient = BigInt(divisor)
  if (divisorCoefficient <= 0n || coefficient % divisorCoefficient !== 0n) {
    throw new Error(`Fixture revenue ${value} is not divisible by ${divisor}.`)
  }

  const quotient = (coefficient / divisorCoefficient).toString()
  if (fraction.length === 0) return quotient
  const padded = quotient.padStart(fraction.length + 1, '0')
  const splitAt = padded.length - fraction.length
  return `${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`.replace(
    /\.0+$/,
    '',
  )
}

async function seedFixtureLocations(
  tx: Parameters<Parameters<ReturnType<typeof drizzle>['transaction']>[0]>[0],
  ownerId: string,
  fixtures: readonly SeedLocationFixture[],
) {
  const fixtureLocationIds = fixtures.map((fixture) => fixture.locationId)
  if (fixtureLocationIds.length > 0) {
    const locationIds = sql.join(
      fixtureLocationIds.map((locationId) => sql`${locationId}`),
      sql`, `,
    )
    const locationsWhere = sql`location_id in (${locationIds})`

    await tx.execute(sql`delete from metric_results where ${locationsWhere}`)
    await tx.execute(sql`delete from metric_rollups where ${locationsWhere}`)
    await tx.execute(sql`delete from metric_runs where ${locationsWhere}`)
    await tx.execute(
      sql`delete from recipe_cost_history where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from recipe_ingredients where recipe_id in (
        select id from recipes where ${locationsWhere}
      )`,
    )
    await tx.execute(sql`delete from recipes where ${locationsWhere}`)
    await tx.execute(
      sql`delete from item_unit_conversions where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from connector_webhook_deliveries where connection_id in (
        select id from connector_connections where ${locationsWhere}
      )`,
    )
    await tx.execute(
      sql`delete from connector_oauth_states where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from connector_connections where ${locationsWhere}`,
    )
    await tx.execute(sql`delete from external_signals where ${locationsWhere}`)
    await tx.execute(
      sql`delete from external_signal_fetches where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from reconciliation_conflicts where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from observability_events where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from csv_upload_history where ${locationsWhere}`,
    )
    await tx.execute(
      sql`delete from inventory_snapshots where ${locationsWhere}`,
    )
    await tx.execute(sql`delete from transactions where ${locationsWhere}`)
    await tx.execute(sql`delete from labor_shifts where ${locationsWhere}`)
    await tx.execute(
      sql`delete from purchase_order_items where ${locationsWhere}`,
    )
    await tx.execute(sql`delete from purchase_orders where ${locationsWhere}`)
    await tx.execute(sql`delete from inventory_items where ${locationsWhere}`)
    await tx.delete(locations).where(sql`${locations.id} in (${locationIds})`)
  }

  for (const fixture of fixtures) {
    await tx.insert(locations).values({
      id: fixture.locationId,
      userId: ownerId,
      name:
        fixture.sales.length >= 365
          ? 'Full-year data kitchen'
          : 'Fourteen-day data kitchen',
      address: '100 Fixture Street',
      timezone: 'America/Denver',
      businessDayBoundary: '04:00:00',
    })

    const itemNames = [
      ...new Set([
        ...fixture.sales.map((sale) => sale.itemName),
        ...fixture.inventorySnapshots.map((snapshot) => snapshot.itemName),
      ]),
    ]
    const itemIds = new Map(itemNames.map((name) => [name, randomUUID()]))

    await tx.insert(inventoryItems).values(
      itemNames.map((name) => ({
        id: itemIds.get(name)!,
        locationId: fixture.locationId,
        canonicalName: name.trim().toLowerCase(),
        displayName: name,
        category: 'fixture',
        unit: 'each',
        itemType: 'menu_item' as const,
        costPerUnit: '5.00',
        menuPrice: '10.00',
      })),
    )

    await tx.insert(transactions).values(
      fixture.sales.map((sale) => ({
        id: randomUUID(),
        locationId: fixture.locationId,
        transactedAt: new Date(sale.transactedAt),
        externalId: sale.externalId,
        source: 'e2e-fixture',
        menuItemId: itemIds.get(sale.itemName)!,
        rawItemName: sale.itemName,
        category: 'fixture',
        qty: sale.qty,
        unitPrice: divideDecimalByInteger(sale.totalRevenue, sale.qty),
        totalRevenue: sale.totalRevenue,
        totalCost: null,
        grossMargin: null,
      })),
    )

    if (fixture.inventorySnapshots.length > 0) {
      await tx.insert(inventorySnapshots).values(
        fixture.inventorySnapshots.map((snapshot) => ({
          id: randomUUID(),
          locationId: fixture.locationId,
          inventoryItemId: itemIds.get(snapshot.itemName)!,
          countedAt: new Date(snapshot.countedAt),
          qty: snapshot.qty,
          source: 'e2e-fixture',
        })),
      )
    }
  }
}

export const seedDatabase = async (
  client: ReturnType<typeof postgres>,
  options: SeedDatabaseOptions = {},
) => {
  const db = drizzle(client)

  await db.transaction(async (tx) => {
    if (options.fixtureLocations) {
      if (!options.ownerId) {
        throw new Error('ownerId is required when seeding fixture locations.')
      }
      await seedFixtureLocations(tx, options.ownerId, options.fixtureLocations)
      return
    }

    await tx
      .insert(user)
      .values({
        id: seedOwnerId,
        name: 'Seed owner',
        email: 'seed-owner@example.invalid',
        emailVerified: true,
      })
      .onConflictDoNothing({ target: user.id })

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
