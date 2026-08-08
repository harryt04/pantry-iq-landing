import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  locations,
  recipeCostHistory,
  recipes,
  transactions,
} from '@/src/server/db/schema'

import {
  buildMenuEngineeringMatrix,
  type MenuEngineeringItem,
  type MenuEngineeringResult,
  type MenuEngineeringSale,
} from './menu-engineering'

const LOOKBACK_DAYS = 365

/**
 * Reads only the selected owner's menu items and sales. Recipe history is the
 * source for plate margin so the matrix never substitutes an unverified cost.
 */
export async function getMenuEngineering(
  headers: Headers,
  locationId: string,
): Promise<MenuEngineeringResult> {
  const owned = await requireOwnedLocation(headers, locationId)
  const from = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [location, items, sales, costHistory] = await Promise.all([
    db
      .select({
        timezone: locations.timezone,
        businessDayBoundary: locations.businessDayBoundary,
      })
      .from(locations)
      .where(eq(locations.id, owned.locationId))
      .limit(1),
    db
      .select({
        menuItemId: inventoryItems.id,
        name: inventoryItems.displayName,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.locationId, owned.locationId),
          eq(inventoryItems.itemType, 'menu_item'),
          eq(inventoryItems.isActive, true),
        ),
      )
      .orderBy(inventoryItems.displayName),
    db
      .select({
        menuItemId: transactions.menuItemId,
        transactedAt: transactions.transactedAt,
        qty: transactions.qty,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.locationId, owned.locationId),
          gte(transactions.transactedAt, from),
          isNotNull(transactions.menuItemId),
        ),
      ),
    db
      .select({
        menuItemId: recipes.menuItemId,
        calculatedAt: recipeCostHistory.calculatedAt,
        plateMargin: recipeCostHistory.plateMargin,
      })
      .from(recipes)
      .innerJoin(recipeCostHistory, eq(recipeCostHistory.recipeId, recipes.id))
      .where(
        and(
          eq(recipes.locationId, owned.locationId),
          eq(recipes.isActive, true),
          eq(recipeCostHistory.status, 'complete'),
        ),
      )
      .orderBy(desc(recipeCostHistory.calculatedAt)),
  ])

  const latestMarginByItem = new Map<string, string | null>()
  for (const row of costHistory) {
    if (!latestMarginByItem.has(row.menuItemId))
      latestMarginByItem.set(row.menuItemId, row.plateMargin)
  }

  const matrixItems: MenuEngineeringItem[] = items.map((item) => ({
    menuItemId: item.menuItemId,
    name: item.name,
    marginPerItem: latestMarginByItem.get(item.menuItemId) ?? null,
  }))
  const matrixSales: MenuEngineeringSale[] = sales.flatMap((sale) =>
    sale.menuItemId
      ? [
          {
            menuItemId: sale.menuItemId,
            transactedAt: sale.transactedAt.toISOString(),
            qty: sale.qty,
          },
        ]
      : [],
  )
  const selectedLocation = location[0]
  if (!selectedLocation) throw new Error('That location could not be loaded.')

  return buildMenuEngineeringMatrix(matrixItems, matrixSales, {
    timezone: selectedLocation.timezone,
    businessDayBoundary: selectedLocation.businessDayBoundary,
  })
}
