'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateRecipeCost,
  type RecipeCostIngredient,
} from '@/src/server/menu/recipe-cost'

type Item = {
  id: string
  displayName: string
  unit: string
  itemType: string
  costPerUnit: string | null
}

type RecipeSummary = {
  id: string
  menuItemId: string
  name: string
  outputQuantity: string
  outputUnit: string
  yieldFactor: string
  wasteFactor: string
}

type SavedRecipe = RecipeSummary & {
  ingredients: Array<{
    ingredientItemId: string | null
    subRecipeId: string | null
    quantity: string
    unit: string
  }>
}

type IngredientRow = {
  ingredientItemId: string
  quantity: string
  unit: string
}

const units = ['each', 'oz', 'lb', 'g', 'kg', 'case']

function money(value: string | null) {
  return value === null ? '—' : `$${value}`
}

export function RecipeBuilder({ locationId }: { locationId: string }) {
  const [items, setItems] = React.useState<Item[]>([])
  const [recipes, setRecipes] = React.useState<RecipeSummary[]>([])
  const [menuItemId, setMenuItemId] = React.useState('')
  const [name, setName] = React.useState('')
  const [outputQuantity, setOutputQuantity] = React.useState('1')
  const [outputUnit, setOutputUnit] = React.useState('each')
  const [ingredients, setIngredients] = React.useState<IngredientRow[]>([])
  const [editingRecipeId, setEditingRecipeId] = React.useState<string | null>(
    null,
  )
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const menuItems = items.filter((item) => item.itemType === 'menu_item')
  const ingredientItems = items.filter((item) => item.itemType === 'ingredient')
  const costIngredients: RecipeCostIngredient[] = ingredients.flatMap((row) => {
    const item = ingredientItems.find(
      (candidate) => candidate.id === row.ingredientItemId,
    )
    if (!item || !row.quantity) return []
    return [
      {
        ingredientItemId: item.id,
        label: item.displayName,
        quantity: row.quantity,
        unit: row.unit,
        itemUnit: item.unit,
        unitCost: item.costPerUnit,
      },
    ]
  })
  const cost = calculateRecipeCost(costIngredients)

  React.useEffect(() => {
    let cancelled = false
    void fetch(`/api/recipes?locationId=${encodeURIComponent(locationId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          items?: Item[]
          recipes?: RecipeSummary[]
          error?: string
        }
        if (!response.ok)
          throw new Error(payload.error ?? 'Recipes could not be loaded.')
        if (!cancelled) {
          setItems(payload.items ?? [])
          setRecipes(payload.recipes ?? [])
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Recipes could not be loaded.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationId])

  function addIngredient() {
    const first = ingredientItems[0]
    if (!first) return
    setIngredients((current) => [
      ...current,
      { ingredientItemId: first.id, quantity: '1', unit: first.unit },
    ])
  }

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    )
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locationId,
          recipeId: editingRecipeId,
          menuItemId,
          name,
          outputQuantity,
          outputUnit,
          ingredients,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        recipe?: RecipeSummary
      }
      if (!response.ok)
        throw new Error(payload.error ?? 'Recipe could not be saved.')
      if (payload.recipe) setEditingRecipeId(payload.recipe.id)
      setMessage(
        'Recipe saved. You can keep building it when you have more to add.',
      )
      const refreshed = await fetch(
        `/api/recipes?locationId=${encodeURIComponent(locationId)}`,
      )
      const next = (await refreshed.json()) as { recipes?: RecipeSummary[] }
      setRecipes(next.recipes ?? [])
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Recipe could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function duplicate(recipe: RecipeSummary) {
    const response = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locationId, duplicateOf: recipe.id }),
    })
    const payload = (await response.json()) as {
      error?: string
      recipe?: SavedRecipe
    }
    if (!response.ok) {
      setMessage(payload.error ?? 'Recipe could not be duplicated.')
      return
    }
    if (payload.recipe) loadSavedRecipe(payload.recipe)
    setMessage(`${recipe.name} was duplicated. Adjust the copy, then save it.`)
  }

  async function edit(recipe: RecipeSummary) {
    const response = await fetch(
      `/api/recipes?locationId=${encodeURIComponent(locationId)}&recipeId=${encodeURIComponent(recipe.id)}`,
    )
    const payload = (await response.json()) as {
      error?: string
      recipe?: SavedRecipe | null
    }
    if (!response.ok || !payload.recipe) {
      setMessage(payload.error ?? 'Recipe could not be loaded.')
      return
    }
    loadSavedRecipe(payload.recipe)
  }

  function loadSavedRecipe(recipe: SavedRecipe) {
    setEditingRecipeId(recipe.id)
    setMenuItemId(recipe.menuItemId)
    setName(recipe.name)
    setOutputQuantity(recipe.outputQuantity)
    setOutputUnit(recipe.outputUnit)
    setIngredients(
      recipe.ingredients.flatMap((ingredient) =>
        ingredient.ingredientItemId
          ? [
              {
                ingredientItemId: ingredient.ingredientItemId,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
              },
            ]
          : [],
      ),
    )
  }

  if (loading)
    return (
      <main className="recipe-page">
        <p>Loading your recipes…</p>
      </main>
    )

  if (!locationId) {
    return (
      <main className="recipe-page">
        <p>Select a location before building a recipe.</p>
      </main>
    )
  }

  return (
    <main className="recipe-page">
      <header className="recipe-header">
        <div>
          <p className="recipe-eyebrow">PantryIQ / recipes</p>
          <h1>Build a recipe as you go.</h1>
          <p>
            Add what you know now. A partial recipe is still useful, and every
            assumption stays visible.
          </p>
        </div>
        <a className="recipe-back-link" href="/account">
          Back to account
        </a>
      </header>

      <div className="recipe-layout">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingRecipeId ? 'Edit recipe' : 'New recipe'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="recipe-form" onSubmit={save}>
              <div className="recipe-field">
                <Label htmlFor="recipe-name">Recipe name</Label>
                <Input
                  id="recipe-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Salmon chowder"
                  required
                />
              </div>
              <div className="recipe-field">
                <Label htmlFor="recipe-menu-item">Menu item</Label>
                <select
                  id="recipe-menu-item"
                  className="recipe-select"
                  value={menuItemId}
                  onChange={(event) => setMenuItemId(event.target.value)}
                  required
                >
                  <option value="">Choose an existing menu item</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="recipe-output-grid">
                <div className="recipe-field">
                  <Label htmlFor="recipe-output-quantity">Makes</Label>
                  <Input
                    id="recipe-output-quantity"
                    value={outputQuantity}
                    onChange={(event) => setOutputQuantity(event.target.value)}
                    inputMode="decimal"
                    required
                  />
                </div>
                <div className="recipe-field">
                  <Label htmlFor="recipe-output-unit">Output unit</Label>
                  <select
                    id="recipe-output-unit"
                    className="recipe-select"
                    value={outputUnit}
                    onChange={(event) => setOutputUnit(event.target.value)}
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="recipe-ingredients-heading">
                <div>
                  <h2>Ingredients</h2>
                  <p>
                    Use the units your kitchen uses. PantryIQ will show where a
                    conversion is unavailable.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addIngredient}
                  disabled={ingredientItems.length === 0}
                >
                  Add ingredient
                </Button>
              </div>

              {ingredients.length === 0 ? (
                <div className="recipe-empty">
                  No ingredients yet. Save the recipe now or add the first item.
                </div>
              ) : (
                <div className="recipe-ingredient-list">
                  {ingredients.map((row, index) => {
                    const item = ingredientItems.find(
                      (candidate) => candidate.id === row.ingredientItemId,
                    )
                    return (
                      <div
                        className="recipe-ingredient-row"
                        key={`${row.ingredientItemId}-${index}`}
                      >
                        <select
                          className="recipe-select"
                          aria-label={`Ingredient ${index + 1}`}
                          value={row.ingredientItemId}
                          onChange={(event) =>
                            updateIngredient(index, {
                              ingredientItemId: event.target.value,
                              unit:
                                ingredientItems.find(
                                  (candidate) =>
                                    candidate.id === event.target.value,
                                )?.unit ?? row.unit,
                            })
                          }
                        >
                          {ingredientItems.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.displayName}
                            </option>
                          ))}
                        </select>
                        <Input
                          aria-label={`Quantity for ${item?.displayName ?? 'ingredient'}`}
                          value={row.quantity}
                          onChange={(event) =>
                            updateIngredient(index, {
                              quantity: event.target.value,
                            })
                          }
                          inputMode="decimal"
                        />
                        <select
                          className="recipe-select"
                          aria-label={`Unit for ${item?.displayName ?? 'ingredient'}`}
                          value={row.unit}
                          onChange={(event) =>
                            updateIngredient(index, {
                              unit: event.target.value,
                            })
                          }
                        >
                          {units.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setIngredients((current) =>
                              current.filter(
                                (_, rowIndex) => rowIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="recipe-actions">
                <Button
                  type="submit"
                  disabled={saving || menuItems.length === 0}
                >
                  {saving ? 'Saving…' : 'Save recipe'}
                </Button>
                {editingRecipeId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingRecipeId(null)
                      setName('')
                      setIngredients([])
                      setMessage(null)
                    }}
                  >
                    Start a new recipe
                  </Button>
                )}
                {message && (
                  <p className="recipe-message" role="status">
                    {message}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="recipe-aside">
          <Card
            className={
              cost.status === 'partial'
                ? 'state-edge--watch'
                : 'state-edge--steady'
            }
          >
            <CardHeader>
              <CardTitle>
                {cost.status === 'partial'
                  ? 'Partial batch cost'
                  : 'Batch cost'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="figure recipe-cost">{money(cost.totalCost)}</p>
              <p className="recipe-muted">
                {cost.status === 'empty'
                  ? 'Add ingredients to see what we can calculate.'
                  : cost.status === 'partial'
                    ? 'This is the known portion. Missing inputs stay out of the total.'
                    : 'Calculated from current item costs and the quantities above.'}
              </p>
              {cost.lines.length > 0 && (
                <ul className="recipe-cost-list">
                  {cost.lines.map((line) => (
                    <li key={line.ingredientItemId}>
                      <span>{line.label}</span>
                      <span className="figure">{money(line.cost)}</span>
                      {line.status !== 'ready' && (
                        <small>
                          {line.detail}{' '}
                          <a href="/account#item-costs">Fix item cost</a>
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved recipes</CardTitle>
            </CardHeader>
            <CardContent>
              {recipes.length === 0 ? (
                <p className="recipe-muted">
                  Your first recipe will appear here.
                </p>
              ) : (
                <ul className="recipe-list">
                  {recipes.map((recipe) => (
                    <li key={recipe.id}>
                      <span>{recipe.name}</span>
                      <span className="recipe-list-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void edit(recipe)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void duplicate(recipe)}
                        >
                          Duplicate
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
