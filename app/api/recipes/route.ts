import { headers } from 'next/headers'

import {
  ForbiddenError,
  UnauthorizedError,
} from '@/src/server/auth/authorization'
import { listInventoryItems } from '@/src/server/inventory/items'
import {
  duplicateRecipe,
  getRecipe,
  listRecipeCostHistory,
  listRecipes,
  RecipeBuilderValidationError,
  RecipeNotFoundError,
  saveRecipe,
} from '@/src/server/menu/recipe-builder'

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof ForbiddenError || error instanceof RecipeNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof RecipeBuilderValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  return Response.json(
    { error: 'We could not save that recipe. Try again.' },
    { status: 500 },
  )
}

function publicItem(
  item: Awaited<ReturnType<typeof listInventoryItems>>[number],
) {
  return {
    id: item.id,
    displayName: item.displayName,
    unit: item.unit,
    itemType: item.itemType,
    costPerUnit: item.costPerUnit,
    menuPrice: item.menuPrice,
  }
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const locationId = searchParams.get('locationId')
  const recipeId = searchParams.get('recipeId')
  if (!locationId)
    return Response.json({ error: 'locationId is required.' }, { status: 400 })

  try {
    const requestHeaders = await headers()
    const [items, recipeRows, selected, costHistory] = await Promise.all([
      listInventoryItems(requestHeaders, locationId),
      listRecipes(requestHeaders, locationId),
      recipeId ? getRecipe(requestHeaders, locationId, recipeId) : null,
      recipeId
        ? listRecipeCostHistory(requestHeaders, locationId, recipeId)
        : Promise.resolve([]),
    ])
    return Response.json({
      items: items.map(publicItem),
      recipes: recipeRows.map((recipe) => ({
        id: recipe.id,
        menuItemId: recipe.menuItemId,
        name: recipe.name,
        outputQuantity: recipe.outputQuantity,
        outputUnit: recipe.outputUnit,
        yieldFactor: recipe.yieldFactor,
        wasteFactor: recipe.wasteFactor,
      })),
      recipe: selected
        ? {
            ...selected.recipe,
            ingredients: selected.ingredients.map((ingredient) => ({
              ingredientItemId: ingredient.ingredientItemId,
              subRecipeId: ingredient.subRecipeId,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
            costHistory,
          }
        : null,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      locationId?: string
      recipeId?: string
      duplicateOf?: string
      duplicateName?: string
      [key: string]: unknown
    }
    if (!body.locationId) {
      return Response.json(
        { error: 'locationId is required.' },
        { status: 400 },
      )
    }
    const requestHeaders = await headers()
    if (body.duplicateOf) {
      const recipe = await duplicateRecipe(
        requestHeaders,
        body.locationId,
        body.duplicateOf,
        body.duplicateName,
      )
      const duplicated = await getRecipe(
        requestHeaders,
        body.locationId,
        recipe.id,
      )
      return Response.json(
        {
          recipe: {
            ...duplicated.recipe,
            ingredients: duplicated.ingredients,
          },
        },
        { status: 201 },
      )
    }

    const { locationId: _locationId, recipeId, ...input } = body
    const recipe = await saveRecipe(
      requestHeaders,
      body.locationId,
      input,
      recipeId ?? undefined,
    )
    return Response.json({ recipe }, { status: recipeId ? 200 : 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
