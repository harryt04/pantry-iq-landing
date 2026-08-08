import { describe, expect, it } from 'vitest'

import { vi } from 'vitest'

vi.mock('@/src/server/auth/authorization', () => ({
  requireOwnedLocation: vi.fn(),
}))
vi.mock('@/src/server/db/client', () => ({ db: {} }))

import {
  calculateRecipeCost,
  RecipeBuilderValidationError,
  validateRecipeBuilderInput,
} from './recipe-builder'

const menuItemId = '11111111-1111-4111-8111-111111111111'
const salmonId = '22222222-2222-4222-8222-222222222222'
const creamId = '33333333-3333-4333-8333-333333333333'

describe('recipe builder input contract', () => {
  it('allows an empty partial recipe and supplies explicit defaults', () => {
    expect(
      validateRecipeBuilderInput({
        menuItemId,
        name: 'Soup base',
        outputUnit: 'qt',
        ingredients: [],
      }),
    ).toEqual({
      menuItemId,
      name: 'Soup base',
      outputQuantity: '1',
      outputUnit: 'qt',
      yieldFactor: '1',
      wasteFactor: '0',
      ingredients: [],
    })
  })

  it('normalizes ingredient rows while keeping quantities as strings', () => {
    expect(
      validateRecipeBuilderInput({
        menuItemId,
        name: 'Salmon chowder',
        outputQuantity: '4',
        outputUnit: 'qt',
        ingredients: [
          { ingredientItemId: salmonId, quantity: '2.5', unit: 'lb' },
          { ingredientItemId: creamId, quantity: '16', unit: 'oz' },
        ],
      }).ingredients,
    ).toEqual([
      { ingredientItemId: salmonId, quantity: '2.5', unit: 'lb' },
      { ingredientItemId: creamId, quantity: '16', unit: 'oz' },
    ])
  })

  it('rejects invalid references, quantities, and waste assumptions', () => {
    expect(() =>
      validateRecipeBuilderInput({
        menuItemId,
        name: 'Bad recipe',
        outputUnit: 'each',
        ingredients: [
          {
            ingredientItemId: salmonId,
            subRecipeId: creamId,
            quantity: '1',
            unit: 'lb',
          },
        ],
      }),
    ).toThrow(RecipeBuilderValidationError)
    expect(() =>
      validateRecipeBuilderInput({
        menuItemId,
        name: 'Bad recipe',
        outputUnit: 'each',
        wasteFactor: '1',
        ingredients: [],
      }),
    ).toThrow('wasteFactor must be less than 1.')
  })
})

describe('recipe live cost projection', () => {
  it('calculates exact batch cost after converting recipe units', () => {
    const result = calculateRecipeCost([
      {
        ingredientItemId: salmonId,
        label: 'Salmon fillet',
        quantity: '2.5',
        unit: 'lb',
        itemUnit: 'oz',
        unitCost: '0.50',
      },
      {
        ingredientItemId: creamId,
        label: 'Cream',
        quantity: '16',
        unit: 'oz',
        itemUnit: 'oz',
        unitCost: '0.25',
      },
    ])

    expect(result.status).toBe('complete')
    expect(result.totalCost).toBe('24')
    expect(result.lines.map((line) => line.cost)).toEqual(['20', '4'])
  })

  it('keeps a missing unit cost visible and returns a partial total', () => {
    const result = calculateRecipeCost([
      {
        ingredientItemId: salmonId,
        label: 'Salmon fillet',
        quantity: '2',
        unit: 'lb',
        itemUnit: 'lb',
        unitCost: null,
      },
      {
        ingredientItemId: creamId,
        label: 'Cream',
        quantity: '8',
        unit: 'oz',
        itemUnit: 'oz',
        unitCost: '0.25',
      },
    ])

    expect(result.status).toBe('partial')
    expect(result.totalCost).toBe('2')
    expect(result.missingCostItemIds).toEqual([salmonId])
    expect(result.lines[0]?.detail).toContain('item master')
  })

  it('does not hide incompatible units inside a zero cost', () => {
    const result = calculateRecipeCost([
      {
        ingredientItemId: salmonId,
        label: 'Salmon fillet',
        quantity: '2',
        unit: 'lb',
        itemUnit: 'each',
        unitCost: '10',
      },
    ])

    expect(result.status).toBe('partial')
    expect(result.totalCost).toBeNull()
    expect(result.lines[0]?.status).toBe('unit-mismatch')
  })
})
