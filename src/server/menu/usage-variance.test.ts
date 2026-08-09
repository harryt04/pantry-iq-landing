import { describe, expect, it } from 'vitest'

import { buildUsageVariance } from './usage-variance'

const periodStart = new Date('2026-01-01T00:00:00.000Z')
const periodEnd = new Date('2026-01-31T23:59:59.000Z')

const ingredient = {
  id: 'ingredient-salmon',
  displayName: 'Salmon',
  unit: 'lb',
}

const recipe = {
  id: 'recipe-salmon',
  menuItemId: 'menu-salmon',
  outputQuantity: '10',
  outputUnit: 'each',
  yieldFactor: '1',
  wasteFactor: '0.1',
  ingredients: [
    { ingredientItemId: ingredient.id, quantity: '18', unit: 'lb' },
  ],
}

describe('theoretical versus actual ingredient usage', () => {
  it('computes recipe usage per ingredient and uses counts as actual usage', () => {
    const result = buildUsageVariance({
      inventoryItems: [ingredient],
      recipes: [recipe],
      sales: [
        {
          menuItemId: recipe.menuItemId,
          qty: '5',
          transactedAt: new Date('2026-01-05T18:00:00.000Z'),
        },
        {
          menuItemId: recipe.menuItemId,
          qty: '5',
          transactedAt: new Date('2026-01-15T18:00:00.000Z'),
        },
      ],
      purchases: [
        {
          inventoryItemId: ingredient.id,
          qty: '160',
          unit: 'oz',
          orderedAt: new Date('2026-01-11T12:00:00.000Z'),
        },
      ],
      snapshots: [
        {
          inventoryItemId: ingredient.id,
          qty: '20',
          countedAt: new Date('2026-01-10T00:00:00.000Z'),
        },
        {
          inventoryItemId: ingredient.id,
          qty: '15',
          countedAt: periodEnd,
        },
      ],
      periodStart,
      periodEnd,
    })

    expect(result.rows).toEqual([
      expect.objectContaining({
        ingredientName: 'Salmon',
        unit: 'lb',
        theoreticalUsage: '10',
        actualUsage: '15',
        variance: '5',
        variancePercent: '50',
        status: 'calculated',
      }),
    ])
    expect(result.rows[0]?.possibleExplanations).toContain(
      'The recipe may be wrong or out of date.',
    )
  })

  it('keeps an ingredient-level result when actual usage cannot be calculated', () => {
    const result = buildUsageVariance({
      inventoryItems: [ingredient],
      recipes: [recipe],
      sales: [
        {
          menuItemId: recipe.menuItemId,
          qty: '1',
          transactedAt: new Date('2026-01-15T18:00:00.000Z'),
        },
      ],
      purchases: [],
      snapshots: [],
      periodStart,
      periodEnd,
    })

    expect(result.rows[0]).toMatchObject({
      theoreticalUsage: '2',
      actualUsage: null,
      variance: null,
      status: 'cannot-calculate',
      reason: 'Need two inventory counts in the selected period.',
    })
  })

  it('excludes sold menu items without recipes instead of inventing ingredient usage', () => {
    const result = buildUsageVariance({
      inventoryItems: [ingredient],
      recipes: [],
      sales: [
        {
          menuItemId: 'menu-without-recipe',
          qty: '3',
          transactedAt: new Date('2026-01-15T18:00:00.000Z'),
        },
      ],
      purchases: [],
      snapshots: [],
      periodStart,
      periodEnd,
    })

    expect(result.rows).toEqual([])
    expect(result.excluded).toEqual([
      {
        menuItemId: 'menu-without-recipe',
        reason: 'No active recipe; its ingredients are excluded from variance.',
      },
    ])
  })

  it('expands sub-recipes with exact output quantities', () => {
    const sauceIngredient = {
      id: 'ingredient-sauce',
      displayName: 'Sauce',
      unit: 'oz',
    }
    const sauce = {
      id: 'recipe-sauce',
      menuItemId: 'menu-sauce',
      outputQuantity: '4',
      outputUnit: 'oz',
      yieldFactor: '1',
      wasteFactor: '0',
      ingredients: [
        { ingredientItemId: sauceIngredient.id, quantity: '8', unit: 'oz' },
      ],
    }
    const dish = {
      id: 'recipe-dish',
      menuItemId: 'menu-dish',
      outputQuantity: '2',
      outputUnit: 'each',
      yieldFactor: '1',
      wasteFactor: '0',
      ingredients: [{ subRecipeId: sauce.id, quantity: '2', unit: 'oz' }],
    }

    const result = buildUsageVariance({
      inventoryItems: [sauceIngredient],
      recipes: [sauce, dish],
      sales: [
        {
          menuItemId: dish.menuItemId,
          qty: '2',
          transactedAt: new Date('2026-01-15T18:00:00.000Z'),
        },
      ],
      purchases: [],
      snapshots: [],
      periodStart,
      periodEnd,
    })

    expect(result.rows[0]?.theoreticalUsage).toBe('4')
  })
})
