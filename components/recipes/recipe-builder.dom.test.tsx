import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RecipeBuilder } from './recipe-builder'

/**
 * `components/recipes/recipe-builder.tsx` was 609 untested lines in the
 * 2026-08-10 audit. A recipe drives plate cost, so the rules that matter are
 * that the builder does not invent a cost it cannot compute, and that it says
 * so when ingredient costs are missing.
 */

const LOCATION_ID = 'location-1'
const fetchMock = vi.fn()

const ITEMS = [
  {
    id: 'item-salmon',
    displayName: 'Salmon',
    unit: 'lb',
    itemType: 'ingredient',
    costPerUnit: '9.50',
    menuPrice: null,
  },
  {
    id: 'item-plate',
    displayName: 'Salmon plate',
    unit: 'each',
    itemType: 'menu_item',
    costPerUnit: null,
    menuPrice: '24.00',
  },
  {
    id: 'item-capers',
    displayName: 'Capers',
    unit: 'oz',
    itemType: 'ingredient',
    costPerUnit: null,
    menuPrice: null,
  },
]

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }
}

function routeFetch(overrides: { load?: unknown; save?: unknown } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') {
      return jsonResponse(
        overrides.load ?? { items: ITEMS, recipes: [], recipe: null },
      )
    }
    return (
      overrides.save ??
      jsonResponse(
        { recipe: { id: 'recipe-1', name: 'Chowder' } },
        { status: 201 },
      )
    )
  })
}

async function renderBuilder() {
  render(<RecipeBuilder locationId={LOCATION_ID} />)
  await screen.findByLabelText('Recipe name')
}

/** Fills the fields the form marks required, so submit is not blocked. */
async function fillRequiredFields(name = 'Chowder') {
  await userEvent.type(screen.getByLabelText('Recipe name'), name)
  await userEvent.selectOptions(
    screen.getByLabelText('Menu item'),
    'item-plate',
  )
}

describe('recipe builder', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    routeFetch()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads items scoped to the caller location', async () => {
    await renderBuilder()

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/recipes?locationId=${LOCATION_ID}`,
    )
  })

  it('says it cannot calculate before any ingredient is added', async () => {
    await renderBuilder()

    expect(
      screen.getByText('Add ingredients to see what we can calculate.'),
    ).toBeInTheDocument()
  })

  it('sends the recipe to the owner-scoped endpoint with its location', async () => {
    await renderBuilder()

    await fillRequiredFields()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add ingredient' }),
    )
    await userEvent.click(screen.getByRole('button', { name: /Save recipe/ }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      expect(post?.[0]).toBe('/api/recipes')
      const body = JSON.parse((post?.[1] as RequestInit).body as string) as {
        locationId: string
        name: string
      }
      expect(body.locationId).toBe(LOCATION_ID)
      expect(body.name).toBe('Chowder')
    })
  })

  it('creates a new recipe with no recipeId attached', async () => {
    await renderBuilder()

    await fillRequiredFields()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add ingredient' }),
    )
    await userEvent.click(screen.getByRole('button', { name: /Save recipe/ }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      const body = JSON.parse((post?.[1] as RequestInit).body as string) as {
        recipeId: string | null
      }
      expect(body.recipeId).toBeNull()
    })
  })

  it('adds an ingredient row carrying the item own unit', async () => {
    await renderBuilder()

    await userEvent.click(
      screen.getByRole('button', { name: 'Add ingredient' }),
    )
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: /Save recipe/ }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      const body = JSON.parse((post?.[1] as RequestInit).body as string) as {
        ingredients: Array<{ unit: string }>
      }
      expect(body.ingredients).toHaveLength(1)
      // A unit invented by the form would silently corrupt the conversion.
      expect(body.ingredients[0]?.unit).toBe('lb')
    })
  })

  it('reports the server reason when a recipe is rejected', async () => {
    routeFetch({
      save: jsonResponse(
        { error: 'Yield factor must be greater than zero.' },
        { ok: false, status: 400 },
      ),
    })
    await renderBuilder()

    await fillRequiredFields()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add ingredient' }),
    )
    await userEvent.click(screen.getByRole('button', { name: /Save recipe/ }))

    expect(
      await screen.findByText('Yield factor must be greater than zero.'),
    ).toBeInTheDocument()
  })

  it('surfaces a load failure instead of showing an empty builder', async () => {
    routeFetch({
      load: undefined,
    })
    fetchMock.mockImplementation(async () =>
      jsonResponse(
        { error: 'Recipes could not be loaded.' },
        { ok: false, status: 500 },
      ),
    )

    render(<RecipeBuilder locationId={LOCATION_ID} />)

    expect(
      await screen.findByText('Recipes could not be loaded.'),
    ).toBeInTheDocument()
  })
})
