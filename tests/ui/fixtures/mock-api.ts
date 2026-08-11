import { test as base, type Page, type Route } from '@playwright/test'

import type {
  AssumptionComparison,
  NormalizedAssumptionOverride,
} from '@/src/server/chat/assumption-override'
import type {
  LocationDeletionSummary,
  listLocations,
} from '@/src/server/locations/locations'
import type { listInventoryItems } from '@/src/server/inventory/items'
import type {
  getRecipe,
  listRecipeCostHistory,
  listRecipes,
} from '@/src/server/menu/recipe-builder'
import type {
  ReconciliationConflict,
  refreshLocationReconciliation,
} from '@/src/server/ingestion/reconciliation'

export const MOCK_LOCATION_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_ITEM_ID = '00000000-0000-4000-8000-000000000002'
export const MOCK_RECIPE_ID = '00000000-0000-4000-8000-000000000003'

export type MockApiOutcome =
  | 'ok'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'unavailable'
  | 'server-error'
  | 'slow'

export type MockApiEndpoint =
  | 'chat'
  | 'chatOverride'
  | 'locations'
  | 'location'
  | 'recipes'
  | 'items'
  | 'reconciliation'

export type MockApiScenario =
  MockApiOutcome | Partial<Record<MockApiEndpoint, MockApiOutcome>>

type LocationRow = Awaited<ReturnType<typeof listLocations>>[number]
type InventoryItemRow = Awaited<ReturnType<typeof listInventoryItems>>[number]
type RecipeRow = Awaited<ReturnType<typeof listRecipes>>[number]
type RecipeDetail = Awaited<ReturnType<typeof getRecipe>>
type RecipeIngredientRow = RecipeDetail['ingredients'][number]
type RecipeCostHistoryRow = Awaited<
  ReturnType<typeof listRecipeCostHistory>
>[number]
type ReconciliationRow = Awaited<
  ReturnType<typeof refreshLocationReconciliation>
>[number]

type PublicInventoryItem = Pick<
  InventoryItemRow,
  | 'id'
  | 'canonicalName'
  | 'displayName'
  | 'category'
  | 'unit'
  | 'itemType'
  | 'shelfLifeDays'
  | 'costPerUnit'
  | 'usageCount'
  | 'isActive'
  | 'updatedAt'
> & {
  effectiveShelfLifeDays: number | null
  shelfLifeSource: 'user' | 'suggestion' | 'unset'
  shelfLifeSuggestionCategory: string | null
}

type RecipeSummary = Pick<
  RecipeRow,
  | 'id'
  | 'menuItemId'
  | 'name'
  | 'outputQuantity'
  | 'outputUnit'
  | 'yieldFactor'
  | 'wasteFactor'
>

type PublicRecipeItem = Pick<
  InventoryItemRow,
  'id' | 'displayName' | 'unit' | 'itemType' | 'costPerUnit' | 'menuPrice'
>

type RecipePayload = RecipeRow & {
  ingredients: Array<
    Pick<
      RecipeIngredientRow,
      'ingredientItemId' | 'subRecipeId' | 'quantity' | 'unit'
    >
  >
  costHistory: RecipeCostHistoryRow[]
}

type RecipePostPayload =
  | RecipeRow
  | (RecipeRow & {
      ingredients: Array<
        Pick<
          RecipeIngredientRow,
          'ingredientItemId' | 'subRecipeId' | 'quantity' | 'unit'
        >
      >
    })

type RecipeGetResponse = {
  items: PublicRecipeItem[]
  recipes: RecipeSummary[]
  recipe: RecipePayload | null
}

type ChatOverridePayload = {
  comparison: AssumptionComparison
  override: NormalizedAssumptionOverride
}

type MockResponseBody =
  | { error: string }
  | { locations: LocationRow[] }
  | { location: LocationRow }
  | { summary: LocationDeletionSummary }
  | { items: PublicInventoryItem[] }
  | RecipeGetResponse
  | { recipe: RecipePostPayload }
  | { comparison: AssumptionComparison; override: NormalizedAssumptionOverride }
  | { conflicts: ReconciliationRow[] }
  | { conflict: ReconciliationConflict }

type MockApiInstaller = (scenario?: MockApiScenario) => Promise<void>

const responseStatuses: Record<
  Exclude<MockApiOutcome, 'ok' | 'slow'>,
  number
> = {
  unauthorized: 401,
  forbidden: 403,
  invalid: 400,
  conflict: 409,
  unavailable: 503,
  'server-error': 500,
}

const now = new Date('2026-08-11T18:00:00.000Z')

const location = {
  id: MOCK_LOCATION_ID,
  userId: '00000000-0000-4000-8000-000000000010',
  name: 'Mock kitchen',
  address: '100 Main Street',
  isActive: true,
  timezone: 'America/Denver',
  businessDayBoundary: '04:00:00',
  createdAt: now,
  updatedAt: now,
} satisfies LocationRow

const inventoryItem = {
  id: MOCK_ITEM_ID,
  locationId: MOCK_LOCATION_ID,
  canonicalName: 'salmon',
  displayName: 'Salmon',
  category: 'Seafood',
  unit: 'lb',
  itemType: 'ingredient',
  shelfLifeDays: null,
  costPerUnit: '9.50',
  menuPrice: null,
  parLevel: null,
  isActive: true,
  usageCount: 12,
  createdAt: now,
  updatedAt: now,
} satisfies InventoryItemRow

const menuItem = {
  ...inventoryItem,
  id: '00000000-0000-4000-8000-000000000004',
  canonicalName: 'salmon entree',
  displayName: 'Salmon entrée',
  itemType: 'menu_item',
  costPerUnit: null,
  menuPrice: '28.00',
} satisfies InventoryItemRow

const recipe = {
  id: MOCK_RECIPE_ID,
  locationId: MOCK_LOCATION_ID,
  menuItemId: menuItem.id,
  name: 'Salmon entrée',
  outputQuantity: '1',
  outputUnit: 'each',
  yieldFactor: '1',
  wasteFactor: '0',
  isActive: true,
  createdAt: now,
  updatedAt: now,
} satisfies RecipeRow

const recipeIngredient = {
  id: '00000000-0000-4000-8000-000000000005',
  recipeId: recipe.id,
  ingredientItemId: inventoryItem.id,
  subRecipeId: null,
  quantity: '6',
  unit: 'oz',
  createdAt: now,
} satisfies RecipeIngredientRow

const reconciliationConflict = {
  id: '00000000-0000-4000-8000-000000000006',
  locationId: MOCK_LOCATION_ID,
  recordKind: 'transaction',
  conflictType: 'period-overlap',
  identityKey: 'transaction|period-overlap|mock-overlap',
  externalId: null,
  periodStart: now,
  periodEnd: new Date('2026-08-12T18:00:00.000Z'),
  sources: ['csv', 'toast'],
  status: 'unresolved',
  authoritySource: null,
  details: {
    message:
      'Sources cover the same period without stable IDs. Choose one source before these rows are used together.',
  },
} satisfies ReconciliationRow

const comparison: AssumptionComparison = {
  itemId: inventoryItem.id,
  itemName: inventoryItem.displayName,
  field: 'shelfLifeDays',
  beforeValue: null,
  afterValue: 5,
  before: {
    financialImpact: '40.00',
    recommendationScore: '72.00',
    urgencyScore: '60.00',
  },
  after: {
    financialImpact: '20.00',
    recommendationScore: '48.00',
    urgencyScore: '40.00',
  },
  calculation: 'deterministic-precompute',
}

function outcomeFor(
  scenario: MockApiScenario | undefined,
  endpoint: MockApiEndpoint,
): MockApiOutcome {
  if (!scenario) return 'ok'
  if (typeof scenario === 'string') return scenario
  return scenario[endpoint] ?? 'ok'
}

function errorBody(outcome: MockApiOutcome): { error: string } {
  switch (outcome) {
    case 'unauthorized':
      return { error: 'You need to sign in to continue.' }
    case 'forbidden':
      return { error: 'That resource is not available to this account.' }
    case 'invalid':
      return { error: 'The request could not be understood.' }
    case 'conflict':
      return { error: 'That change conflicts with current data.' }
    case 'unavailable':
      return { error: 'This service is temporarily unavailable.' }
    case 'server-error':
      return { error: 'Something went wrong. Try again.' }
    default:
      return { error: 'The request could not be completed.' }
  }
}

async function fulfill(
  page: Page,
  route: Route,
  outcome: MockApiOutcome,
  body: MockResponseBody | string,
  status = 200,
) {
  if (outcome === 'slow') await page.waitForTimeout(400)
  if (status === 204) {
    await route.fulfill({ status })
    return
  }
  if (typeof body === 'string') {
    await route.fulfill({
      body,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
      status,
    })
    return
  }
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function handleMockRequest(
  page: Page,
  route: Route,
  scenario: MockApiScenario | undefined,
) {
  const request = route.request()
  const { pathname } = new URL(request.url())
  const endpoint: MockApiEndpoint | null =
    pathname === '/api/chat'
      ? 'chat'
      : pathname === '/api/chat/override'
        ? 'chatOverride'
        : pathname === '/api/locations'
          ? 'locations'
          : pathname.startsWith('/api/locations/')
            ? 'location'
            : pathname === '/api/recipes'
              ? 'recipes'
              : pathname === '/api/items'
                ? 'items'
                : pathname === '/api/reconciliation'
                  ? 'reconciliation'
                  : null

  if (!endpoint) {
    await route.fallback()
    return
  }

  const outcome = outcomeFor(scenario, endpoint)
  if (outcome !== 'ok' && outcome !== 'slow') {
    await fulfill(
      page,
      route,
      outcome,
      errorBody(outcome),
      responseStatuses[outcome],
    )
    return
  }

  if (endpoint === 'chat') {
    await fulfill(
      page,
      route,
      outcome,
      [
        'Observation: Salmon has about $40 at risk from current spoilage.',
        'Financial impact: About $40 at risk from current spoilage.',
        'Prediction: Not provided. The available history earns an observation, not a prediction.',
        'Recommendation: Consider reviewing Salmon this week.',
        'Show your work: Ask to review the sources, calculations, and assumptions behind this recommendation.',
      ].join('\n'),
    )
    return
  }

  if (endpoint === 'chatOverride') {
    await fulfill(page, route, outcome, {
      comparison,
      override: {
        itemId: inventoryItem.id,
        field: comparison.field,
        value: comparison.afterValue,
      },
    } satisfies ChatOverridePayload)
    return
  }

  if (endpoint === 'locations') {
    if (request.method() === 'POST') {
      await fulfill(page, route, outcome, { location })
    } else {
      await fulfill(page, route, outcome, { locations: [location] })
    }
    return
  }

  if (endpoint === 'location') {
    if (request.method() === 'DELETE') {
      await fulfill(page, route, outcome, '', 204)
    } else if (request.method() === 'GET') {
      await fulfill(page, route, outcome, {
        summary: {
          locationName: location.name,
          importCount: 1,
          importedRowCount: 12,
        },
      })
    } else {
      await fulfill(page, route, outcome, { location })
    }
    return
  }

  if (endpoint === 'recipes') {
    if (request.method() === 'POST') {
      const requestBody = request.postDataJSON() as {
        duplicateOf?: unknown
      }
      await fulfill(page, route, outcome, {
        recipe:
          typeof requestBody.duplicateOf === 'string'
            ? { ...recipe, ingredients: [recipeIngredient] }
            : recipe,
      })
    } else {
      const recipeId = new URL(request.url()).searchParams.get('recipeId')
      await fulfill(page, route, outcome, {
        items: [
          {
            id: inventoryItem.id,
            displayName: inventoryItem.displayName,
            unit: inventoryItem.unit,
            itemType: inventoryItem.itemType,
            costPerUnit: inventoryItem.costPerUnit,
            menuPrice: inventoryItem.menuPrice,
          },
          {
            id: menuItem.id,
            displayName: menuItem.displayName,
            unit: menuItem.unit,
            itemType: menuItem.itemType,
            costPerUnit: menuItem.costPerUnit,
            menuPrice: menuItem.menuPrice,
          },
        ],
        recipes: [recipe],
        recipe: recipeId
          ? {
              ...recipe,
              ingredients: [recipeIngredient],
              costHistory: [],
            }
          : null,
      })
    }
    return
  }

  if (endpoint === 'items') {
    await fulfill(page, route, outcome, {
      items: [
        {
          ...inventoryItem,
          effectiveShelfLifeDays: 3,
          shelfLifeSource: 'suggestion',
          shelfLifeSuggestionCategory: 'Seafood',
        },
      ],
    })
    return
  }

  if (request.method() === 'POST') {
    await fulfill(page, route, outcome, {
      conflict: {
        ...reconciliationConflict,
        status: 'resolved',
        authoritySource: 'csv',
      },
    })
  } else {
    await fulfill(page, route, outcome, {
      conflicts: [reconciliationConflict],
    })
  }
}

export const test = base.extend<{ mockApi: MockApiInstaller }>({
  mockApi: async ({ page }, use) => {
    await page.route('**/api/**', (route) =>
      handleMockRequest(page, route, undefined),
    )
    await use(async (scenario) => {
      await page.unroute('**/api/**')
      await page.route('**/api/**', (route) =>
        handleMockRequest(page, route, scenario),
      )
    })
  },
})

export { expect } from '@playwright/test'
