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
import type {
  CanonicalField,
  CsvMappingDetection,
} from '@/src/server/csv/mapping'
import type { CsvPreview } from '@/src/server/csv/parser'

export const MOCK_LOCATION_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_ITEM_ID = '00000000-0000-4000-8000-000000000002'
export const MOCK_RECIPE_ID = '00000000-0000-4000-8000-000000000003'
export const MOCK_UPLOAD_ID = '00000000-0000-4000-8000-000000000007'

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
  | 'uploads'
  | 'uploadPreview'
  | 'uploadMapping'
  | 'uploadCommit'

type MockApiScenarioOptions = Partial<
  Record<MockApiEndpoint, MockApiOutcome>
> & {
  mappingReview?: boolean
  reconciliationSave?: MockApiOutcome
  uploadFailure?: { filename: string; message: string }
}

export type MockApiScenario = MockApiOutcome | MockApiScenarioOptions

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

type MockUploadSummary = {
  rowsToImport: number
  rowsImported: number
  newItems: number
  linkedItems: number
  alreadyImported: boolean
  ready: boolean
  unmatchedItems: Array<{
    rawItemName: string
    normalizedItemName: string
    reason: 'empty-name' | 'no-exact-match' | 'ambiguous-match'
    occurrenceCount: number
    rowNumbers: number[]
    context: Array<{ rowNumber: number; values: Record<string, string> }>
  }>
  items: Array<{
    id: string
    canonicalName: string
    displayName: string
    category: string | null
    unit: string
    isActive?: boolean
  }>
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
  | { upload: { id: string; filename: string } }
  | { preview: CsvPreview & { mapping: CsvMappingDetection } }
  | { mapping: Record<string, string | null> }
  | { summary: MockUploadSummary }
  | { error: string; summary: MockUploadSummary }

type MockApiInstaller = (scenario?: MockApiScenario) => Promise<void>
type MockApiState = {
  savedMapping: Record<string, CanonicalField | null> | null
  resolvedReconciliationIds: Set<string>
  failedUploadFilenames: Set<string>
}

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

const uploadPreview = {
  encoding: 'utf-8' as const,
  delimiter: ',' as const,
  hasHeader: true,
  columns: ['Date', 'Item', 'Quantity'],
  columnCount: 3,
  rowCount: 1,
  readableRowCount: 1,
  previewRows: [
    { rowNumber: 2, values: ['2026-08-01', 'unmatched item', '2'] },
  ],
  problems: [],
  mapping: {
    importType: 'transactions' as const,
    mapping: {
      Date: 'transactedAt' as const,
      Item: 'rawItemName' as const,
      Quantity: 'qty' as const,
    },
    reused: false,
    columns: [
      {
        sourceColumn: 'Date',
        sourceIndex: 0,
        targetField: 'transactedAt' as const,
        confidence: 0.98,
        band: 'auto' as const,
        evidence: ['header match'],
        candidates: [],
      },
      {
        sourceColumn: 'Item',
        sourceIndex: 1,
        targetField: 'rawItemName' as const,
        confidence: 0.98,
        band: 'auto' as const,
        evidence: ['header match'],
        candidates: [],
      },
      {
        sourceColumn: 'Quantity',
        sourceIndex: 2,
        targetField: 'qty' as const,
        confidence: 0.98,
        band: 'auto' as const,
        evidence: ['header match'],
        candidates: [],
      },
    ],
  },
} satisfies CsvPreview & { mapping: CsvMappingDetection }

const mappingReviewPreview = {
  ...uploadPreview,
  mapping: {
    ...uploadPreview.mapping,
    mapping: {
      ...uploadPreview.mapping.mapping,
      Quantity: 'qty' as const,
    },
    columns: uploadPreview.mapping.columns.map((column) =>
      column.sourceColumn === 'Quantity'
        ? {
            ...column,
            targetField: 'qty' as const,
            confidence: 0.64,
            band: 'review' as const,
            evidence: ['number-shaped values'] as string[],
            candidates: [
              {
                field: 'qty' as const,
                confidence: 0.64,
                evidence: ['number-shaped values'],
                prior: false,
              },
              {
                field: 'totalRevenue' as const,
                confidence: 0.58,
                evidence: ['number-shaped values'],
                prior: false,
              },
            ],
          }
        : column,
    ),
  },
} satisfies CsvPreview & { mapping: CsvMappingDetection }

const uploadItem = {
  id: MOCK_ITEM_ID,
  canonicalName: 'unmatched item',
  displayName: 'Unmatched item',
  category: null,
  unit: 'each',
  isActive: true,
}

const unresolvedUploadSummary = {
  rowsToImport: 1,
  rowsImported: 0,
  newItems: 0,
  linkedItems: 0,
  alreadyImported: false,
  ready: false,
  unmatchedItems: [
    {
      rawItemName: 'unmatched item',
      normalizedItemName: 'unmatched item',
      reason: 'no-exact-match' as const,
      occurrenceCount: 1,
      rowNumbers: [2],
      context: [
        {
          rowNumber: 2,
          values: {
            Date: '2026-08-01',
            Item: 'unmatched item',
            Quantity: '2',
          },
        },
      ],
    },
  ],
  items: [uploadItem],
}

const readyUploadSummary = {
  ...unresolvedUploadSummary,
  linkedItems: 1,
  ready: true,
  unmatchedItems: [],
}

function outcomeFor(
  scenario: MockApiScenario | undefined,
  endpoint: MockApiEndpoint,
): MockApiOutcome {
  if (!scenario) return 'ok'
  if (typeof scenario === 'string') return scenario
  return scenario[endpoint] ?? 'ok'
}

function isMappingReviewScenario(scenario: MockApiScenario | undefined) {
  return typeof scenario === 'object' && scenario?.mappingReview === true
}

function reconciliationSaveOutcome(scenario: MockApiScenario | undefined) {
  return typeof scenario === 'object'
    ? (scenario.reconciliationSave ?? 'ok')
    : 'ok'
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
  state: MockApiState,
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
                  : pathname === '/api/uploads' && request.method() === 'POST'
                    ? 'uploads'
                    : /^\/api\/uploads\/[^/]+\/preview$/.test(pathname)
                      ? 'uploadPreview'
                      : /^\/api\/uploads\/[^/]+\/mapping$/.test(pathname)
                        ? 'uploadMapping'
                        : /^\/api\/uploads\/[^/]+\/commit$/.test(pathname)
                          ? 'uploadCommit'
                          : null

  if (!endpoint) {
    await route.fallback()
    return
  }

  const outcome =
    endpoint === 'reconciliation' && request.method() === 'POST'
      ? reconciliationSaveOutcome(scenario)
      : outcomeFor(scenario, endpoint)
  const uploadFailure =
    endpoint === 'uploads' && typeof scenario === 'object'
      ? scenario.uploadFailure
      : undefined
  const uploadFilename = request.headers()['x-pantryiq-filename']
  if (
    uploadFailure &&
    uploadFilename === uploadFailure.filename &&
    !state.failedUploadFilenames.has(uploadFilename)
  ) {
    state.failedUploadFilenames.add(uploadFilename)
    await fulfill(page, route, 'invalid', { error: uploadFailure.message }, 400)
    return
  }
  if (endpoint === 'uploadCommit' && outcome === 'conflict') {
    const requestBody = request.postDataJSON() as {
      dryRun?: boolean
      resolutions?: Record<string, unknown>
    }
    if (!requestBody.dryRun) {
      await fulfill(
        page,
        route,
        outcome,
        { error: 'One or more item names are still unresolved.' },
        409,
      )
      return
    }
    if (Object.keys(requestBody.resolutions ?? {}).length > 0) {
      const hasNewItem = Object.values(requestBody.resolutions ?? {}).some(
        (resolution) =>
          typeof resolution === 'object' &&
          resolution !== null &&
          'canonicalName' in resolution,
      )
      await fulfill(page, route, 'ok', {
        summary: hasNewItem
          ? { ...readyUploadSummary, newItems: 1, linkedItems: 0 }
          : readyUploadSummary,
      })
      return
    }
    await fulfill(
      page,
      route,
      outcome,
      {
        error: 'One or more item names are still unresolved.',
        summary: unresolvedUploadSummary,
      },
      409,
    )
    return
  }
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
        'Observation: Tomato Soup has about $40 at risk from current spoilage.',
        'Financial impact: About $40 at risk from current spoilage.',
        'Prediction: Not provided. The available history earns an observation, not a prediction.',
        'Recommendation: Consider reviewing Tomato Soup this week.',
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

  if (endpoint === 'uploads') {
    await fulfill(page, route, outcome, {
      upload: { id: MOCK_UPLOAD_ID, filename: 'sales.csv' },
    })
    return
  }

  if (endpoint === 'uploadMapping') {
    const requestBody = request.postDataJSON() as {
      mapping?: Record<string, CanonicalField | null>
    }
    if (isMappingReviewScenario(scenario) && requestBody.mapping) {
      state.savedMapping = requestBody.mapping
    }
    await fulfill(page, route, outcome, {
      mapping: state.savedMapping ?? uploadPreview.mapping.mapping,
    })
    return
  }

  if (endpoint === 'uploadPreview' && isMappingReviewScenario(scenario)) {
    const preview = state.savedMapping
      ? {
          ...mappingReviewPreview,
          mapping: {
            ...mappingReviewPreview.mapping,
            mapping: state.savedMapping,
            reused: true,
            columns: mappingReviewPreview.mapping.columns.map((column) => ({
              ...column,
              targetField: (state.savedMapping?.[column.sourceColumn] ??
                column.targetField) as CanonicalField | null,
            })),
          },
        }
      : mappingReviewPreview
    await fulfill(page, route, outcome, { preview })
    return
  }

  if (endpoint === 'uploadPreview') {
    await fulfill(page, route, outcome, { preview: uploadPreview })
    return
  }

  if (endpoint === 'uploadCommit') {
    await fulfill(page, route, outcome, { summary: readyUploadSummary })
    return
  }

  if (request.method() === 'POST') {
    const requestBody = request.postDataJSON() as {
      conflictId?: string
      authoritySource?: string
    }
    if (requestBody.conflictId) {
      state.resolvedReconciliationIds.add(requestBody.conflictId)
    }
    await fulfill(page, route, outcome, {
      conflict: {
        ...reconciliationConflict,
        status: 'resolved',
        authoritySource: requestBody.authoritySource ?? 'csv',
      },
    })
  } else {
    await fulfill(page, route, outcome, {
      conflicts: state.resolvedReconciliationIds.has(reconciliationConflict.id)
        ? []
        : [reconciliationConflict],
    })
  }
}

export const test = base.extend<{ mockApi: MockApiInstaller }>({
  mockApi: async ({ page }, use) => {
    const state: MockApiState = {
      savedMapping: null,
      resolvedReconciliationIds: new Set(),
      failedUploadFilenames: new Set(),
    }
    await page.route('**/api/**', (route) =>
      handleMockRequest(page, route, undefined, state),
    )
    await use(async (scenario) => {
      state.savedMapping = null
      state.resolvedReconciliationIds.clear()
      state.failedUploadFilenames.clear()
      await page.unroute('**/api/**')
      await page.route('**/api/**', (route) =>
        handleMockRequest(page, route, scenario, state),
      )
    })
  },
})

export { expect } from '@playwright/test'
