export type RecipeIngredientReference =
  | { ingredientItemId: string; subRecipeId?: never }
  | { ingredientItemId?: never; subRecipeId: string }

export type RecipeDefinition = {
  id: string
  ingredients: readonly RecipeIngredientReference[]
}

export class RecipeGraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeGraphError'
  }
}

/**
 * Validates the recipe dependency graph before expansion. The database
 * prevents self-invalid ingredient rows; this traversal also catches an
 * indirect cycle such as sauce -> marinade -> sauce.
 */
export function assertAcyclicRecipeGraph(
  recipes: readonly RecipeDefinition[],
): void {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []

  const visit = (recipeId: string) => {
    if (visiting.has(recipeId)) {
      const cycleStart = path.indexOf(recipeId)
      const cycle = [...path.slice(cycleStart), recipeId].join(' -> ')
      throw new RecipeGraphError(`Recipe cycle detected: ${cycle}.`)
    }
    if (visited.has(recipeId)) return

    const recipe = byId.get(recipeId)
    if (!recipe) {
      throw new RecipeGraphError(`Recipe ${recipeId} does not exist.`)
    }

    visiting.add(recipeId)
    path.push(recipeId)
    for (const ingredient of recipe.ingredients) {
      if ('subRecipeId' in ingredient) visit(ingredient.subRecipeId)
    }
    path.pop()
    visiting.delete(recipeId)
    visited.add(recipeId)
  }

  for (const recipe of recipes) visit(recipe.id)
}
