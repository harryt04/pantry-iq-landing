import { and, eq, gte, isNotNull } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  inventorySnapshots,
  itemUnitConversions,
  locations,
  purchaseOrderItems,
  purchaseOrders,
  recipeIngredients,
  recipes,
  transactions,
} from '@/src/server/db/schema'

import {
  buildUsageVariance,
  type UsageIngredient,
  type UsageVarianceResult,
} from './usage-variance'

const LOOKBACK_DAYS = 365

/** Reads only one owner's recipe, purchasing, sales, and count data. */
export async function getUsageVariance(
  headers: Headers,
  locationId: string,
): Promise<UsageVarianceResult> {
  const owned = await requireOwnedLocation(headers, locationId)
  const periodEnd = new Date()
  const periodStart = new Date(
    periodEnd.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  )

  const [
    location,
    items,
    recipeRows,
    ingredientRows,
    sales,
    purchases,
    snapshots,
    conversions,
  ] = await Promise.all([
    db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.id, owned.locationId))
      .limit(1),
    db
      .select({
        id: inventoryItems.id,
        displayName: inventoryItems.displayName,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.locationId, owned.locationId),
          eq(inventoryItems.isActive, true),
        ),
      )
      .orderBy(inventoryItems.displayName),
    db
      .select({
        id: recipes.id,
        menuItemId: recipes.menuItemId,
        outputQuantity: recipes.outputQuantity,
        outputUnit: recipes.outputUnit,
        yieldFactor: recipes.yieldFactor,
        wasteFactor: recipes.wasteFactor,
      })
      .from(recipes)
      .where(
        and(
          eq(recipes.locationId, owned.locationId),
          eq(recipes.isActive, true),
        ),
      ),
    db
      .select({
        recipeId: recipeIngredients.recipeId,
        ingredientItemId: recipeIngredients.ingredientItemId,
        subRecipeId: recipeIngredients.subRecipeId,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
      })
      .from(recipeIngredients)
      .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
      .where(
        and(
          eq(recipes.locationId, owned.locationId),
          eq(recipes.isActive, true),
        ),
      ),
    db
      .select({
        menuItemId: transactions.menuItemId,
        qty: transactions.qty,
        transactedAt: transactions.transactedAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.locationId, owned.locationId),
          gte(transactions.transactedAt, periodStart),
          isNotNull(transactions.menuItemId),
        ),
      ),
    db
      .select({
        inventoryItemId: purchaseOrderItems.inventoryItemId,
        qty: purchaseOrderItems.qty,
        unit: inventoryItems.unit,
        orderedAt: purchaseOrders.orderedAt,
      })
      .from(purchaseOrderItems)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId),
      )
      .innerJoin(
        inventoryItems,
        eq(inventoryItems.id, purchaseOrderItems.inventoryItemId),
      )
      .where(
        and(
          eq(purchaseOrderItems.locationId, owned.locationId),
          gte(purchaseOrders.orderedAt, periodStart),
          isNotNull(purchaseOrderItems.inventoryItemId),
        ),
      ),
    db
      .select({
        inventoryItemId: inventorySnapshots.inventoryItemId,
        qty: inventorySnapshots.qty,
        countedAt: inventorySnapshots.countedAt,
      })
      .from(inventorySnapshots)
      .where(
        and(
          eq(inventorySnapshots.locationId, owned.locationId),
          gte(inventorySnapshots.countedAt, periodStart),
        ),
      ),
    db
      .select({
        inventoryItemId: itemUnitConversions.inventoryItemId,
        fromUnit: itemUnitConversions.fromUnit,
        toUnit: itemUnitConversions.toUnit,
        factor: itemUnitConversions.factor,
      })
      .from(itemUnitConversions)
      .where(eq(itemUnitConversions.locationId, owned.locationId)),
  ])

  if (!location[0]) throw new Error('That location could not be loaded.')

  const ingredientsByRecipe = new Map<string, UsageIngredient[]>()
  for (const row of ingredientRows) {
    const lines = ingredientsByRecipe.get(row.recipeId) ?? []
    lines.push({
      quantity: row.quantity,
      unit: row.unit,
      ...(row.ingredientItemId
        ? { ingredientItemId: row.ingredientItemId }
        : {}),
      ...(row.subRecipeId ? { subRecipeId: row.subRecipeId } : {}),
    })
    ingredientsByRecipe.set(row.recipeId, lines)
  }

  return buildUsageVariance({
    inventoryItems: items,
    recipes: recipeRows.map((recipe) => ({
      ...recipe,
      ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
    })),
    sales: sales.flatMap((sale) =>
      sale.menuItemId
        ? [
            {
              menuItemId: sale.menuItemId,
              qty: sale.qty,
              transactedAt: sale.transactedAt,
            },
          ]
        : [],
    ),
    purchases: purchases.flatMap((purchase) =>
      purchase.inventoryItemId
        ? [
            {
              inventoryItemId: purchase.inventoryItemId,
              qty: purchase.qty,
              unit: purchase.unit,
              orderedAt: purchase.orderedAt,
            },
          ]
        : [],
    ),
    snapshots,
    conversions,
    periodStart,
    periodEnd,
  })
}
