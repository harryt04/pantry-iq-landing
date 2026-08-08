import { describe, expect, it } from 'vitest'

import { assertAcyclicRecipeGraph, RecipeGraphError } from './recipe-graph'

describe('recipe dependency graph', () => {
  it('allows a sub-recipe tree and empty recipes', () => {
    expect(() =>
      assertAcyclicRecipeGraph([
        { id: 'sauce', ingredients: [] },
        { id: 'dish', ingredients: [{ subRecipeId: 'sauce' }] },
        { id: 'empty', ingredients: [] },
      ]),
    ).not.toThrow()
  })

  it('rejects direct and indirect cycles before recursive expansion', () => {
    expect(() =>
      assertAcyclicRecipeGraph([
        { id: 'sauce', ingredients: [{ subRecipeId: 'sauce' }] },
      ]),
    ).toThrow('sauce -> sauce')

    expect(() =>
      assertAcyclicRecipeGraph([
        { id: 'sauce', ingredients: [{ subRecipeId: 'marinade' }] },
        { id: 'marinade', ingredients: [{ subRecipeId: 'sauce' }] },
      ]),
    ).toThrow(RecipeGraphError)
  })

  it('rejects a missing sub-recipe reference', () => {
    expect(() =>
      assertAcyclicRecipeGraph([
        { id: 'dish', ingredients: [{ subRecipeId: 'missing' }] },
      ]),
    ).toThrow('does not exist')
  })
})
