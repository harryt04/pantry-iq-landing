import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import { requireOwnedLocation } from '@/src/server/auth/authorization'
import { db } from '@/src/server/db/client'
import {
  inventoryItems,
  recipeCostHistory,
  recipeIngredients,
  recipes,
} from '@/src/server/db/schema'

import { calculateRecipePlateCost } from './recipe-cost'
import { convertQuantity, UnitConversionError } from './unit-conversion'

export { calculateRecipePlateCost } from './recipe-cost'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

export type RecipeIngredientInput =
  | {
      ingredientItemId: string
      quantity: string
      unit: string
    }
  | {
      quantity: string
      subRecipeId: string
      unit: string
    }

export type RecipeBuilderInput = {
  menuItemId: string
  name: string
  outputQuantity?: string
  outputUnit: string
  yieldFactor?: string
  wasteFactor?: string
  ingredients: RecipeIngredientInput[]
}

export type ValidatedRecipeBuilderInput = {
  menuItemId: string
  name: string
  outputQuantity: string
  outputUnit: string
  yieldFactor: string
  wasteFactor: string
  ingredients: RecipeIngredientInput[]
}

export class RecipeBuilderValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeBuilderValidationError'
  }
}

export class RecipeNotFoundError extends Error {
  constructor() {
    super('That recipe is not available to this account.')
    this.name = 'RecipeNotFoundError'
  }
}

export type RecipeCostLine = {
  ingredientItemId: string
  label: string
  cost: string | null
  status: 'ready' | 'missing-cost' | 'unit-mismatch'
  detail: string
}

export type RecipeCost = {
  status: 'empty' | 'partial' | 'complete'
  totalCost: string | null
  lines: RecipeCostLine[]
  missingCostItemIds: string[]
}

function recordInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RecipeBuilderValidationError('A recipe object is required.')
  }
  return input as Record<string, unknown>
}

function requiredText(values: Record<string, unknown>, field: string): string {
  const value = values[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RecipeBuilderValidationError(`${field} is required.`)
  }
  return value.trim()
}

function decimal(value: unknown, field: string, defaultValue?: string): string {
  const candidate = value === undefined ? defaultValue : value
  if (typeof candidate !== 'string' || !decimalPattern.test(candidate.trim())) {
    throw new RecipeBuilderValidationError(
      `${field} must be a non-negative decimal string.`,
    )
  }
  return candidate.trim()
}

function assertUuid(value: string, field: string) {
  if (!uuidPattern.test(value)) {
    throw new RecipeBuilderValidationError(`${field} must be a UUID.`)
  }
}

function assertPositive(value: string, field: string) {
  if (/^0(?:\.0+)?$/.test(value)) {
    throw new RecipeBuilderValidationError(`${field} must be greater than 0.`)
  }
}

export function validateRecipeBuilderInput(
  input: unknown,
): ValidatedRecipeBuilderInput {
  const values = recordInput(input)
  const menuItemId = requiredText(values, 'menuItemId')
  assertUuid(menuItemId, 'menuItemId')
  const name = requiredText(values, 'name')
  const outputUnit = requiredText(values, 'outputUnit')
  const outputQuantity = decimal(values.outputQuantity, 'outputQuantity', '1')
  const yieldFactor = decimal(values.yieldFactor, 'yieldFactor', '1')
  const wasteFactor = decimal(values.wasteFactor, 'wasteFactor', '0')
  assertPositive(outputQuantity, 'outputQuantity')
  assertPositive(yieldFactor, 'yieldFactor')
  if (Number(wasteFactor) >= 1) {
    throw new RecipeBuilderValidationError('wasteFactor must be less than 1.')
  }

  if (!Array.isArray(values.ingredients)) {
    throw new RecipeBuilderValidationError('ingredients must be an array.')
  }

  const ingredients = values.ingredients.map((value, index) => {
    const ingredient = recordInput(value)
    const ingredientItemId = ingredient.ingredientItemId
    const subRecipeId = ingredient.subRecipeId
    const hasIngredient = typeof ingredientItemId === 'string'
    const hasSubRecipe = typeof subRecipeId === 'string'
    if (hasIngredient === hasSubRecipe) {
      throw new RecipeBuilderValidationError(
        `ingredients[${index}] must reference one item or sub-recipe.`,
      )
    }
    const reference = hasIngredient
      ? { ingredientItemId: ingredientItemId as string }
      : { subRecipeId: subRecipeId as string }
    const referenceField = hasIngredient ? 'ingredientItemId' : 'subRecipeId'
    const referenceId = (
      hasIngredient ? ingredientItemId : subRecipeId
    ) as string
    assertUuid(referenceId, `ingredients[${index}].${referenceField}`)
    const quantity = decimal(
      ingredient.quantity,
      `ingredients[${index}].quantity`,
    )
    assertPositive(quantity, `ingredients[${index}].quantity`)
    const unit = requiredText(ingredient, 'unit')
    return { ...reference, quantity, unit } as RecipeIngredientInput
  })

  return {
    menuItemId,
    name,
    outputQuantity,
    outputUnit,
    yieldFactor,
    wasteFactor,
    ingredients,
  }
}

type DecimalParts = { digits: bigint; scale: number }

function decimalParts(value: string): DecimalParts {
  const [whole, fraction = ''] = value.split('.')
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length }
}

function decimalString(parts: DecimalParts): string {
  if (parts.digits === 0n) return '0'
  const raw = parts.digits.toString().padStart(parts.scale + 1, '0')
  if (parts.scale === 0) return raw
  return `${raw.slice(0, -parts.scale)}.${raw.slice(-parts.scale)}`.replace(
    /\.?(\d*?)0+$/,
    (_, fraction: string) => (fraction ? `.${fraction}` : ''),
  )
}

function addDecimals(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  const scale = Math.max(a.scale, b.scale)
  const leftDigits = a.digits * 10n ** BigInt(scale - a.scale)
  const rightDigits = b.digits * 10n ** BigInt(scale - b.scale)
  return decimalString({ digits: leftDigits + rightDigits, scale })
}

function multiplyDecimals(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  return decimalString({
    digits: a.digits * b.digits,
    scale: a.scale + b.scale,
  })
}

export type RecipeCostIngredient = {
  ingredientItemId: string
  label: string
  quantity: string
  unit: string
  itemUnit: string
  unitCost: string | null
  casePackSize?: string
}

/**
 * Calculates the known cost of a recipe batch. Unknown costs stay visible as
 * partial rather than being treated as zero, and all arithmetic remains in
 * decimal strings so money never touches a float.
 */
export function calculateRecipeCost(
  ingredients: readonly RecipeCostIngredient[],
): RecipeCost {
  if (ingredients.length === 0) {
    return {
      status: 'empty',
      totalCost: null,
      lines: [],
      missingCostItemIds: [],
    }
  }

  let totalCost = '0'
  const missingCostItemIds: string[] = []
  const lines = ingredients.map((ingredient) => {
    if (ingredient.unitCost === null) {
      missingCostItemIds.push(ingredient.ingredientItemId)
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost: null,
        status: 'missing-cost' as const,
        detail: 'Unit cost is missing. Add it in the item master.',
      }
    }

    try {
      const quantityInItemUnit = convertQuantity(
        ingredient.quantity,
        ingredient.unit,
        ingredient.itemUnit,
        ingredient.casePackSize
          ? { casePackSize: ingredient.casePackSize }
          : undefined,
      )
      const cost = multiplyDecimals(quantityInItemUnit, ingredient.unitCost)
      totalCost = addDecimals(totalCost, cost)
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost,
        status: 'ready' as const,
        detail: `${quantityInItemUnit} ${ingredient.itemUnit} × ${ingredient.unitCost}`,
      }
    } catch (error) {
      const detail =
        error instanceof UnitConversionError
          ? error.message
          : 'The item units could not be converted.'
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost: null,
        status: 'unit-mismatch' as const,
        detail,
      }
    }
  })

  const hasUnpricedLine = lines.some((line) => line.status !== 'ready')
  return {
    status: hasUnpricedLine ? 'partial' : 'complete',
    totalCost:
      totalCost === '0' && lines.every((line) => line.cost === null)
        ? null
        : totalCost,
    lines,
    missingCostItemIds,
  }
}

function recipeValues(locationId: string, input: ValidatedRecipeBuilderInput) {
  return {
    locationId,
    menuItemId: input.menuItemId,
    name: input.name,
    outputQuantity: input.outputQuantity,
    outputUnit: input.outputUnit,
    yieldFactor: input.yieldFactor,
    wasteFactor: input.wasteFactor,
  }
}

async function assertRecipeReferences(
  locationId: string,
  input: ValidatedRecipeBuilderInput,
) {
  const ingredientIds = input.ingredients.flatMap((ingredient) =>
    'ingredientItemId' in ingredient ? [ingredient.ingredientItemId] : [],
  )
  const subRecipeIds = input.ingredients.flatMap((ingredient) =>
    'subRecipeId' in ingredient ? [ingredient.subRecipeId] : [],
  )
  const itemIds = [input.menuItemId, ...ingredientIds]
  const items = await db
    .select({ id: inventoryItems.id, itemType: inventoryItems.itemType })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.locationId, locationId),
        inArray(inventoryItems.id, itemIds),
      ),
    )

  if (items.length !== new Set(itemIds).size) {
    throw new RecipeBuilderValidationError(
      'Every recipe item must belong to the selected location.',
    )
  }
  const menuItem = items.find((item) => item.id === input.menuItemId)
  if (menuItem?.itemType !== 'menu_item') {
    throw new RecipeBuilderValidationError(
      'The recipe output must be an active menu item.',
    )
  }
  if (
    items.some(
      (item) =>
        ingredientIds.includes(item.id) && item.itemType !== 'ingredient',
    )
  ) {
    throw new RecipeBuilderValidationError(
      'Recipe ingredients must be purchased ingredient items.',
    )
  }

  if (subRecipeIds.length > 0) {
    const subRecipes = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        and(
          eq(recipes.locationId, locationId),
          inArray(recipes.id, subRecipeIds),
        ),
      )
    if (subRecipes.length !== new Set(subRecipeIds).size) {
      throw new RecipeBuilderValidationError(
        'Every sub-recipe must belong to the selected location.',
      )
    }
  }
}

export async function listRecipes(headers: Headers, locationId: string) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  return db
    .select()
    .from(recipes)
    .where(eq(recipes.locationId, ownedLocation.locationId))
    .orderBy(asc(recipes.name), asc(recipes.id))
}

export async function getRecipe(
  headers: Headers,
  locationId: string,
  recipeId: string,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  if (!uuidPattern.test(recipeId)) throw new RecipeNotFoundError()
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.id, recipeId),
        eq(recipes.locationId, ownedLocation.locationId),
      ),
    )
    .limit(1)
  if (!recipe) throw new RecipeNotFoundError()
  const ingredients = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipe.id))
    .orderBy(asc(recipeIngredients.createdAt), asc(recipeIngredients.id))
  return { recipe, ingredients }
}

export async function listRecipeCostHistory(
  headers: Headers,
  locationId: string,
  recipeId: string,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  if (!uuidPattern.test(recipeId)) throw new RecipeNotFoundError()
  return db
    .select()
    .from(recipeCostHistory)
    .where(
      and(
        eq(recipeCostHistory.recipeId, recipeId),
        eq(recipeCostHistory.locationId, ownedLocation.locationId),
      ),
    )
    .orderBy(desc(recipeCostHistory.calculatedAt))
}

export async function saveRecipe(
  headers: Headers,
  locationId: string,
  input: unknown,
  recipeId?: string,
) {
  const ownedLocation = await requireOwnedLocation(headers, locationId)
  const values = validateRecipeBuilderInput(input)
  if (recipeId !== undefined && !uuidPattern.test(recipeId)) {
    throw new RecipeNotFoundError()
  }
  await assertRecipeReferences(ownedLocation.locationId, values)

  return db.transaction(async (transaction) => {
    let savedRecipe
    if (recipeId) {
      const [updated] = await transaction
        .update(recipes)
        .set({
          ...recipeValues(ownedLocation.locationId, values),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recipes.id, recipeId),
            eq(recipes.locationId, ownedLocation.locationId),
          ),
        )
        .returning()
      if (!updated) throw new RecipeNotFoundError()
      savedRecipe = updated
      await transaction
        .delete(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, savedRecipe.id))
    } else {
      const [created] = await transaction
        .insert(recipes)
        .values(recipeValues(ownedLocation.locationId, values))
        .returning()
      if (!created)
        throw new RecipeBuilderValidationError('Recipe could not be saved.')
      savedRecipe = created
    }

    if (values.ingredients.length > 0) {
      await transaction.insert(recipeIngredients).values(
        values.ingredients.map((ingredient) => ({
          recipeId: savedRecipe.id,
          ingredientItemId:
            'ingredientItemId' in ingredient
              ? ingredient.ingredientItemId
              : null,
          subRecipeId:
            'subRecipeId' in ingredient ? ingredient.subRecipeId : null,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      )
    }

    const referencedItemIds = [
      values.menuItemId,
      ...values.ingredients.flatMap((ingredient) =>
        'ingredientItemId' in ingredient ? [ingredient.ingredientItemId] : [],
      ),
    ]
    const currentItems = await transaction
      .select({
        id: inventoryItems.id,
        displayName: inventoryItems.displayName,
        unit: inventoryItems.unit,
        costPerUnit: inventoryItems.costPerUnit,
        menuPrice: inventoryItems.menuPrice,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.locationId, ownedLocation.locationId),
          inArray(inventoryItems.id, referencedItemIds),
        ),
      )
    const itemById = new Map(currentItems.map((item) => [item.id, item]))
    const costIngredients = values.ingredients.map((ingredient) => {
      if ('subRecipeId' in ingredient) {
        return {
          ingredientItemId: ingredient.subRecipeId,
          label: `Sub-recipe ${ingredient.subRecipeId}`,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          itemUnit: ingredient.unit,
          unitCost: null,
        }
      }
      const item = itemById.get(ingredient.ingredientItemId)
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: item?.displayName ?? 'Ingredient',
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        itemUnit: item?.unit ?? ingredient.unit,
        unitCost: item?.costPerUnit ?? null,
      }
    })
    const batchCost = calculateRecipeCost(costIngredients)
    const menuItem = itemById.get(values.menuItemId)
    const plateCost = calculateRecipePlateCost({
      batchCost: batchCost.totalCost,
      outputQuantity: values.outputQuantity,
      outputUnit: values.outputUnit,
      yieldFactor: values.yieldFactor,
      wasteFactor: values.wasteFactor,
      menuPrice: menuItem?.menuPrice ?? null,
    })
    await transaction.insert(recipeCostHistory).values({
      locationId: ownedLocation.locationId,
      recipeId: savedRecipe.id,
      calculatedAt: new Date(),
      status: batchCost.status,
      batchCost: batchCost.totalCost,
      costPerOutput: plateCost.costPerOutput,
      menuPrice: plateCost.menuPrice,
      plateMargin: plateCost.plateMargin,
      foodCostPercentage: plateCost.foodCostPercentage,
      evidence: {
        recipe: {
          outputQuantity: values.outputQuantity,
          outputUnit: values.outputUnit,
          yieldFactor: values.yieldFactor,
          wasteFactor: values.wasteFactor,
        },
        batch: batchCost,
        plate: plateCost,
      },
    })
    return savedRecipe
  })
}

export async function duplicateRecipe(
  headers: Headers,
  locationId: string,
  recipeId: string,
  name?: string,
) {
  const existing = await getRecipe(headers, locationId, recipeId)
  return saveRecipe(headers, locationId, {
    menuItemId: existing.recipe.menuItemId,
    name: name?.trim() || `${existing.recipe.name} copy`,
    outputQuantity: existing.recipe.outputQuantity,
    outputUnit: existing.recipe.outputUnit,
    yieldFactor: existing.recipe.yieldFactor,
    wasteFactor: existing.recipe.wasteFactor,
    ingredients: existing.ingredients.map((ingredient) =>
      ingredient.ingredientItemId
        ? {
            ingredientItemId: ingredient.ingredientItemId,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          }
        : {
            subRecipeId: ingredient.subRecipeId as string,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          },
    ),
  })
}
