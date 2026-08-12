import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildRequest,
  callRoute,
  setRequestHeaders,
} from '../helpers/api-request'

vi.mock('next/headers', async () => {
  const { nextHeadersMock } = await import('../helpers/api-request')
  return nextHeadersMock()
})

const updateInventoryItem = vi.fn()
const listInventoryItems = vi.fn()
const listRecipes = vi.fn()
const getRecipe = vi.fn()
const saveRecipe = vi.fn()
const duplicateRecipe = vi.fn()
const listRecipeCostHistory = vi.fn()

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}
vi.mock('@/src/server/auth/authorization', () => ({
  UnauthorizedError,
  ForbiddenError,
}))

class InventoryItemNotFoundError extends Error {}
vi.mock('@/src/server/inventory/items', () => ({
  updateInventoryItem: (...args: unknown[]) => updateInventoryItem(...args),
  listInventoryItems: (...args: unknown[]) => listInventoryItems(...args),
  InventoryItemNotFoundError,
}))

class InventoryItemValidationError extends Error {}
vi.mock('@/src/server/inventory/item-input', () => ({
  InventoryItemValidationError,
}))

class RecipeNotFoundError extends Error {}
class RecipeBuilderValidationError extends Error {}
vi.mock('@/src/server/menu/recipe-builder', () => ({
  listRecipes: (...args: unknown[]) => listRecipes(...args),
  getRecipe: (...args: unknown[]) => getRecipe(...args),
  saveRecipe: (...args: unknown[]) => saveRecipe(...args),
  duplicateRecipe: (...args: unknown[]) => duplicateRecipe(...args),
  listRecipeCostHistory: (...args: unknown[]) => listRecipeCostHistory(...args),
  RecipeNotFoundError,
  RecipeBuilderValidationError,
}))

const items = await import('@/app/api/items/[itemId]/route')
const recipes = await import('@/app/api/recipes/route')

const LOCATION_ID = '00000000-0000-4000-8000-00000000b001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000b002'
const ITEM_ID = 'item-1'
const RECIPE_ID = 'recipe-1'

describe('PATCH /api/items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('updates the item within the named location', async () => {
    updateInventoryItem.mockResolvedValue({
      id: ITEM_ID,
      displayName: 'Salmon',
    })
    const headers = setRequestHeaders({ cookie: 'session=owner' })

    const { status, body } = await callRoute(
      items.PATCH,
      buildRequest(`/api/items/${ITEM_ID}`, {
        method: 'PATCH',
        query: { locationId: LOCATION_ID },
        body: { displayName: 'Salmon' },
      }),
      { itemId: ITEM_ID },
    )

    expect(status).toBe(200)
    expect(body).toEqual({ item: { id: ITEM_ID, displayName: 'Salmon' } })
    expect(updateInventoryItem).toHaveBeenCalledWith(
      headers,
      LOCATION_ID,
      ITEM_ID,
      { displayName: 'Salmon' },
    )
  })

  it('requires locationId, so an item can never be updated location-free', async () => {
    const { status, body } = await callRoute(
      items.PATCH,
      buildRequest(`/api/items/${ITEM_ID}`, {
        method: 'PATCH',
        body: { displayName: 'Salmon' },
      }),
      { itemId: ITEM_ID },
    )

    expect(status).toBe(400)
    expect(body).toMatchObject({ error: 'locationId is required.' })
    expect(updateInventoryItem).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 404],
    ['a missing item', new InventoryItemNotFoundError('Gone.'), 404],
    [
      'invalid input',
      new InventoryItemValidationError('Unit is required.'),
      400,
    ],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    updateInventoryItem.mockRejectedValue(thrown)

    const { status } = await callRoute(
      items.PATCH,
      buildRequest(`/api/items/${ITEM_ID}`, {
        method: 'PATCH',
        query: { locationId: OTHER_LOCATION_ID },
        body: {},
      }),
      { itemId: ITEM_ID },
    )

    expect(status).toBe(expected)
  })
})

describe('GET /api/recipes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
    listInventoryItems.mockResolvedValue([])
    listRecipes.mockResolvedValue([])
    listRecipeCostHistory.mockResolvedValue([])
  })

  it('returns a trimmed item shape that hides internal costing fields', async () => {
    listInventoryItems.mockResolvedValue([
      {
        id: ITEM_ID,
        displayName: 'Salmon',
        unit: 'lb',
        itemType: 'ingredient',
        costPerUnit: '9.50',
        menuPrice: '24.00',
        supplierContract: 'confidential',
        userId: 'owner-1',
      },
    ])

    const { status, body } = await callRoute(
      recipes.GET,
      buildRequest('/api/recipes', { query: { locationId: LOCATION_ID } }),
    )

    expect(status).toBe(200)
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('supplierContract')
    expect(serialized).not.toContain('userId')
  })

  it('requires a location', async () => {
    const { status } = await callRoute(
      recipes.GET,
      buildRequest('/api/recipes'),
    )

    expect(status).toBe(400)
    expect(listRecipes).not.toHaveBeenCalled()
  })

  it('loads one recipe with its cost history when a recipeId is given', async () => {
    getRecipe.mockResolvedValue({
      recipe: { id: RECIPE_ID, name: 'Chowder' },
      ingredients: [
        {
          ingredientItemId: ITEM_ID,
          subRecipeId: null,
          quantity: '2',
          unit: 'lb',
        },
      ],
    })
    listRecipeCostHistory.mockResolvedValue([
      { at: '2026-08-01', cost: '4.00' },
    ])

    const { status, body } = await callRoute(
      recipes.GET,
      buildRequest('/api/recipes', {
        query: { locationId: LOCATION_ID, recipeId: RECIPE_ID },
      }),
    )

    expect(status).toBe(200)
    expect(body).toMatchObject({
      recipe: {
        id: RECIPE_ID,
        name: 'Chowder',
        costHistory: [{ at: '2026-08-01', cost: '4.00' }],
      },
    })
  })

  it('returns a null recipe and skips history when no recipeId is given', async () => {
    const { body } = await callRoute(
      recipes.GET,
      buildRequest('/api/recipes', { query: { locationId: LOCATION_ID } }),
    )

    expect(body).toMatchObject({ recipe: null })
    expect(getRecipe).not.toHaveBeenCalled()
    expect(listRecipeCostHistory).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 404],
    ['a missing recipe', new RecipeNotFoundError('Gone.'), 404],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    listRecipes.mockRejectedValue(thrown)

    const { status } = await callRoute(
      recipes.GET,
      buildRequest('/api/recipes', {
        query: { locationId: OTHER_LOCATION_ID },
      }),
    )

    expect(status).toBe(expected)
  })
})

describe('POST /api/recipes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRequestHeaders({ cookie: 'session=owner' })
  })

  it('answers 201 when it creates a recipe', async () => {
    saveRecipe.mockResolvedValue({ id: RECIPE_ID, name: 'Chowder' })

    const { status, body } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { locationId: LOCATION_ID, name: 'Chowder' },
      }),
    )

    expect(status).toBe(201)
    expect(body).toEqual({ recipe: { id: RECIPE_ID, name: 'Chowder' } })
  })

  it('treats the form null recipeId as a new recipe', async () => {
    saveRecipe.mockResolvedValue({ id: RECIPE_ID, name: 'Chowder' })

    const { status } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { locationId: LOCATION_ID, recipeId: null, name: 'Chowder' },
      }),
    )

    expect(status).toBe(201)
    expect(saveRecipe).toHaveBeenCalledWith(
      expect.any(Headers),
      LOCATION_ID,
      { name: 'Chowder' },
      undefined,
    )
  })

  it('answers 200 when it updates an existing recipe', async () => {
    saveRecipe.mockResolvedValue({ id: RECIPE_ID, name: 'Chowder' })

    const { status } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { locationId: LOCATION_ID, recipeId: RECIPE_ID, name: 'Chowder' },
      }),
    )

    expect(status).toBe(200)
  })

  it('does not forward locationId or recipeId into the recipe input', async () => {
    saveRecipe.mockResolvedValue({ id: RECIPE_ID })

    await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { locationId: LOCATION_ID, recipeId: RECIPE_ID, name: 'Chowder' },
      }),
    )

    const [call] = saveRecipe.mock.calls
    expect(call?.[2]).toEqual({ name: 'Chowder' })
    expect(call?.[3]).toBe(RECIPE_ID)
  })

  it('duplicates through the owner-scoped service and answers 201', async () => {
    duplicateRecipe.mockResolvedValue({ id: 'recipe-2' })
    getRecipe.mockResolvedValue({
      recipe: { id: 'recipe-2', name: 'Chowder copy' },
      ingredients: [],
    })

    const { status, body } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: {
          locationId: LOCATION_ID,
          duplicateOf: RECIPE_ID,
          duplicateName: 'Chowder copy',
        },
      }),
    )

    expect(status).toBe(201)
    expect(body).toMatchObject({ recipe: { id: 'recipe-2' } })
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('requires a location before it writes', async () => {
    const { status } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { name: 'Chowder' },
      }),
    )

    expect(status).toBe(400)
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated', new UnauthorizedError('Sign in first.'), 401],
    ['another account', new ForbiddenError('Not available.'), 404],
    [
      'invalid input',
      new RecipeBuilderValidationError('Yield must be positive.'),
      400,
    ],
    ['unexpected fault', new Error('connection reset'), 500],
  ])('maps %s to %i', async (_label, thrown, expected) => {
    saveRecipe.mockRejectedValue(thrown)

    const { status } = await callRoute(
      recipes.POST,
      buildRequest('/api/recipes', {
        method: 'POST',
        body: { locationId: OTHER_LOCATION_ID, name: 'Chowder' },
      }),
    )

    expect(status).toBe(expected)
  })
})
