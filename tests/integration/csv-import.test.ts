import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import { TrendSummaries } from '../../components/dashboard/trend-summaries'
import {
  closeAppDatabaseClient,
  integrationDatabaseEnabled,
  openTestDatabase,
  type OpenTestDatabase,
} from '../helpers/test-database'
import {
  MemoryObjectStorage,
  type ObjectStorage,
} from '../../src/server/storage/object-storage'
import { normalizeExactItemName } from '../../src/server/csv/item-resolution'
import type { ImportItemResolution } from '../../src/server/csv/import-plan'
import { buildPartialDataFindings } from '../../src/server/metrics/partial-data'
import { partialDataLocationFixture } from '../fixtures/pantry'

/**
 * `src/server/csv/imports.ts` was the largest untested module in the
 * 2026-08-10 audit at 502 lines, and the one the deleted
 * tests/csv-import-contract.test.ts claimed to cover by grepping for
 * `db.transaction`.
 *
 * These tests run a real upload row through preview and commit against a real
 * database, then count what landed.
 */

type StubSession = { user: { id: string } } | null
const sessionState: { current: StubSession } = { current: null }

vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: async () => sessionState.current } },
}))

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const STORAGE_KEY = 'uploads/sales.csv'
const SETUP_TIMEOUT_MS = 120_000

const CSV = [
  'Date,Item,Quantity,Unit price,Total',
  '2026-08-01T18:00:00Z,Salmon,2,24.00,48.00',
  '2026-08-01T19:00:00Z,Potato,5,2.00,10.00',
  '',
].join('\n')

const MAPPING = {
  Date: 'transactedAt',
  Item: 'rawItemName',
  Quantity: 'qty',
  'Unit price': 'unitPrice',
  Total: 'totalRevenue',
}

const FULL_YEAR_MAPPING = {
  Date: 'transactedAt',
  'Item Name': 'rawItemName',
  Qty: 'qty',
  'Unit Price': 'unitPrice',
  'Total Revenue': 'totalRevenue',
}

const REFUNDS_MAPPING = {
  Date: 'transactedAt',
  'Item Name': 'rawItemName',
  Qty: 'qty',
  'Total Revenue': 'totalRevenue',
}

const BUSINESS_DAY_MAPPING = {
  Date: 'transactedAt',
  'Item Name': 'rawItemName',
  Qty: 'qty',
  'Total Revenue': 'totalRevenue',
}

const MONEY_PRECISION_MAPPING = {
  Date: 'transactedAt',
  Item: 'rawItemName',
  Qty: 'qty',
  'Unit Price': 'unitPrice',
  'Total Revenue': 'totalRevenue',
  'Total Cost': 'totalCost',
}

const PURCHASE_ORDER_MAPPING = {
  'Order Date': 'orderedAt',
  Supplier: 'supplierName',
  'PO Number': 'externalId',
  Item: 'rawItemName',
  Qty: 'qty',
  'Unit Cost': 'unitCost',
  'Total Cost': 'totalCost',
}

const LABOR_MAPPING = {
  'Clock In': 'shiftStart',
  'Clock Out': 'shiftEnd',
  'Staff ID': 'employeeReference',
  'Job Title': 'role',
  'Hours Worked': 'actualHours',
  'Wage Cost': 'laborCost',
}

const STAFFING_SALES_MAPPING = {
  Date: 'transactedAt',
  Item: 'rawItemName',
  Quantity: 'qty',
  'Unit price': 'unitPrice',
  'Total cost': 'totalCost',
  Total: 'totalRevenue',
}

const STAFFING_SALES_CSV = [
  'Date,Item,Quantity,Unit price,Total cost,Total',
  '2026-08-01T10:00:00,House Salad,1,240.00,60.00,240.00',
  '2026-08-01T17:00:00,House Salad,1,160.00,40.00,160.00',
  '',
].join('\n')

const PARTIAL_MAPPING = {
  Date: 'transactedAt',
  Item: 'rawItemName',
  Quantity: 'qty',
  'Unit price': 'unitPrice',
  Total: 'totalRevenue',
}

const PARTIAL_CSV = [
  'Date,Item,Quantity,Unit price,Total',
  ...partialDataLocationFixture.sales.map((sale) => {
    const unitPrice = sale.itemName === 'Tomato Soup' ? '8.50' : '11.00'
    return `${sale.transactedAt},${sale.itemName},${sale.qty},${unitPrice},${sale.totalRevenue}`
  }),
  '',
].join('\n')

/**
 * A CSV names items in the operator's own words. Anything the importer cannot
 * match to an existing item has to be resolved by the user before commit, so
 * every commit test supplies the two decisions the fixture file provokes.
 */
const RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Salmon')]: {
    canonicalName: 'salmon',
    displayName: 'Salmon',
    category: 'Seafood',
    unit: 'lb',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Potato')]: {
    canonicalName: 'potato',
    displayName: 'Potato',
    category: 'Produce',
    unit: 'lb',
    shelfLifeDays: null,
  },
}

const FULL_YEAR_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Salmon Fillet')]: {
    canonicalName: 'salmon fillet',
    displayName: 'Salmon Fillet',
    category: 'seafood',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('House Salad')]: {
    canonicalName: 'house salad',
    displayName: 'House Salad',
    category: 'produce',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Tomato Soup')]: {
    canonicalName: 'tomato soup',
    displayName: 'Tomato Soup',
    category: 'prepared food',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Bubble Tea')]: {
    canonicalName: 'bubble tea',
    displayName: 'Bubble Tea',
    category: 'beverage',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Burger')]: {
    canonicalName: 'burger',
    displayName: 'Burger',
    category: 'prepared food',
    unit: 'each',
    shelfLifeDays: null,
  },
}

const REFUNDS_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Salmon Fillet')]: {
    canonicalName: 'salmon fillet',
    displayName: 'Salmon Fillet',
    category: 'seafood',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('House Salad')]: {
    canonicalName: 'house salad',
    displayName: 'House Salad',
    category: 'produce',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Tomato Soup')]: {
    canonicalName: 'tomato soup',
    displayName: 'Tomato Soup',
    category: 'prepared food',
    unit: 'each',
    shelfLifeDays: null,
  },
}

const BUSINESS_DAY_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Salmon Fillet')]: {
    canonicalName: 'salmon fillet',
    displayName: 'Salmon Fillet',
    category: 'seafood',
    unit: 'each',
    shelfLifeDays: null,
  },
}

const MONEY_PRECISION_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Tomato Soup')]: {
    canonicalName: 'tomato soup',
    displayName: 'Tomato Soup',
    category: 'prepared food',
    unit: 'each',
    shelfLifeDays: null,
  },
}

const PURCHASE_ORDER_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Salmon Fillet')]: {
    canonicalName: 'salmon fillet',
    displayName: 'Salmon Fillet',
    category: 'seafood',
    unit: 'lb',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Romaine Lettuce')]: {
    canonicalName: 'romaine lettuce',
    displayName: 'Romaine Lettuce',
    category: 'produce',
    unit: 'lb',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('Tomato')]: {
    canonicalName: 'tomato',
    displayName: 'Tomato',
    category: 'produce',
    unit: 'lb',
    shelfLifeDays: null,
  },
}

const STAFFING_SALES_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('House Salad')]: {
    canonicalName: 'house salad',
    displayName: 'House Salad',
    category: 'produce',
    unit: 'each',
    shelfLifeDays: null,
  },
}

const PARTIAL_RESOLUTIONS: Record<string, ImportItemResolution> = {
  [normalizeExactItemName('Tomato Soup')]: {
    canonicalName: 'tomato soup',
    displayName: 'Tomato Soup',
    category: 'prepared food',
    unit: 'each',
    shelfLifeDays: null,
  },
  [normalizeExactItemName('House Salad')]: {
    canonicalName: 'house salad',
    displayName: 'House Salad',
    category: 'produce',
    unit: 'each',
    shelfLifeDays: null,
  },
}

/** Serves the CSV from memory so the test needs no S3. */
function memoryStorage(body = CSV): ObjectStorage {
  return {
    putObject: async () => {},
    deleteObject: async () => {},
    getObject: async () => ({
      async *[Symbol.asyncIterator]() {
        yield new TextEncoder().encode(body)
      },
    }),
  }
}

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let imports: typeof import('../../src/server/csv/imports')
let uploads: typeof import('../../src/server/csv/uploads')
let previews: typeof import('../../src/server/csv/previews')
let mappings: typeof import('../../src/server/csv/mapping-persistence')
let exportsService: typeof import('../../src/server/csv/exports')

function csvBody(body: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
}

async function countTransactions(locationId = LOCATION_ID) {
  const { sql } = opened!.database
  const [row] = await sql<{ count: string }[]>`
    select count(*)::text as count from transactions where location_id = ${locationId}
  `
  return Number(row?.count ?? 0)
}

async function countItems(locationId = LOCATION_ID) {
  const { sql } = opened!.database
  const [row] = await sql<{ count: string }[]>`
    select count(*)::text as count from inventory_items where location_id = ${locationId}
  `
  return Number(row?.count ?? 0)
}

/**
 * Inserts the upload-history row a real upload would have created. `source`
 * holds the import type, and `storage_key` is globally unique, so each seeded
 * upload gets its own.
 */
let seededUploads = 0
async function seedUpload(
  locationId = LOCATION_ID,
  options: {
    filename?: string
    mapping?: Record<string, string>
    source?: string
  } = {},
) {
  const { sql } = opened!.database
  seededUploads += 1
  const storageKey = `${STORAGE_KEY}-${seededUploads}`
  const [row] = await sql<{ id: string }[]>`
    insert into csv_upload_history
      (location_id, filename, source, status, rows_imported, mapping_used,
       storage_key, uploaded_at)
    values
      (${locationId}, ${options.filename ?? 'sales.csv'}, ${options.source ?? 'transactions'}, 'uploaded', 0,
       ${JSON.stringify(options.mapping ?? MAPPING)}::jsonb, ${storageKey}, now())
    returning id
  `
  return row!.id
}

describe.skipIf(!integrationDatabaseEnabled())('CSV import', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    imports = await import('../../src/server/csv/imports')
    uploads = await import('../../src/server/csv/uploads')
    previews = await import('../../src/server/csv/previews')
    mappings = await import('../../src/server/csv/mapping-persistence')
    exportsService = await import('../../src/server/csv/exports')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from transactions`
    await sql`delete from csv_upload_history`
    await sql`delete from purchase_order_items`
    await sql`delete from purchase_orders`
    await sql`delete from recipe_cost_history`
    await sql`delete from recipe_ingredients`
    await sql`delete from recipes`
    await sql`delete from inventory_items`
    await sql`delete from locations`
    await sql`delete from "user"`

    await sql`
      insert into "user" (id, name, email)
      values
        (${OWNER_ID}, 'Owner', 'owner@example.com'),
        (${OTHER_OWNER_ID}, 'Other', 'other@example.com')
    `
    await sql`
      insert into locations (id, user_id, name)
      values
        (${LOCATION_ID}, ${OWNER_ID}, 'North'),
        (${OTHER_LOCATION_ID}, ${OTHER_OWNER_ID}, 'South')
    `

    sessionState.current = { user: { id: OWNER_ID } }
  })

  describe('preview', () => {
    it('reports what would be imported without writing anything', async () => {
      const uploadId = await seedUpload()

      const summary = await imports.previewCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      expect(summary.rowsToImport).toBe(2)
      expect(summary.ready).toBe(true)
      expect(await countTransactions()).toBe(0)
      expect(await countItems()).toBe(0)
    })

    it('reports unmatched names instead of guessing at them', async () => {
      const uploadId = await seedUpload()

      const summary = await imports.previewCsvImport(
        new Headers(),
        uploadId,
        undefined,
        memoryStorage(),
      )

      expect(summary.ready).toBe(false)
      expect(summary.unmatchedItems.length).toBeGreaterThan(0)
    })

    it('refuses an upload belonging to another account', async () => {
      const uploadId = await seedUpload(OTHER_LOCATION_ID)

      await expect(
        imports.previewCsvImport(
          new Headers(),
          uploadId,
          undefined,
          memoryStorage(),
        ),
      ).rejects.toThrow()
    })

    it('refuses an unauthenticated caller', async () => {
      const uploadId = await seedUpload()
      sessionState.current = null

      await expect(
        imports.previewCsvImport(
          new Headers(),
          uploadId,
          undefined,
          memoryStorage(),
        ),
      ).rejects.toThrow()
    })

    it('refuses an upload id that does not exist', async () => {
      await expect(
        imports.previewCsvImport(
          new Headers(),
          '00000000-0000-4000-8000-0000000000ff',
          undefined,
          memoryStorage(),
        ),
      ).rejects.toBeInstanceOf(imports.CsvImportNotFoundError)
    })
  })

  describe('commit', () => {
    it('writes the rows and creates the items they name', async () => {
      const uploadId = await seedUpload()

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      expect(summary.rowsImported).toBe(2)
      expect(await countTransactions()).toBe(2)
      expect(await countItems()).toBe(2)
    })

    it('imports a full year, crosses the prediction gate, and readies the dashboard', async () => {
      const csv = await readFile(
        path.resolve(
          'tests/fixtures/csv/transactions/sales-one-year-daily.csv',
        ),
        'utf8',
      )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-one-year-daily.csv',
        mapping: FULL_YEAR_MAPPING,
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        FULL_YEAR_RESOLUTIONS,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(1_825)
      expect(await countTransactions()).toBe(1_825)

      const { runPrecomputeForLocation } =
        await import('../../src/server/metrics/precompute')
      const run = await runPrecomputeForLocation(LOCATION_ID, {
        now: new Date('2026-01-01T12:00:00.000Z'),
      })
      expect(run?.status).toBe('succeeded')

      const { sql } = opened!.database
      const [sufficiency] = await sql<
        {
          status: string
          value: string | null
          result: {
            components?: { history?: string }
            predictionEligible?: boolean
          }
        }[]
      >`
        select status, value, result
        from metric_rollups
        where run_id = ${run!.id} and metric_key = 'dataSufficiency'
      `
      expect(sufficiency).toMatchObject({
        status: 'calculated',
        value: expect.any(String),
        result: {
          components: { history: '100' },
          predictionEligible: true,
        },
      })

      const { getDashboardDataState } =
        await import('../../src/server/metrics/dashboard-state')
      await expect(
        getDashboardDataState(new Headers(), LOCATION_ID),
      ).resolves.toEqual({
        status: 'ready',
        transactionDays: 365,
        requiredDays: 7,
        remainingDays: 0,
      })
    }, 120_000)

    it('keeps short history observational and names the missing requirement', async () => {
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'partial-history.csv',
        mapping: PARTIAL_MAPPING,
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        PARTIAL_RESOLUTIONS,
        memoryStorage(PARTIAL_CSV),
      )

      expect(summary.rowsImported).toBe(partialDataLocationFixture.sales.length)

      const { runPrecomputeForLocation } =
        await import('../../src/server/metrics/precompute')
      const run = await runPrecomputeForLocation(LOCATION_ID, {
        now: new Date('2025-01-15T12:00:00.000Z'),
      })
      expect(run?.status).toBe('succeeded')

      const { sql } = opened!.database
      const [sufficiency] = await sql<
        {
          result: {
            inputs?: {
              historyWeeks?: string
              predictionHistoryWeeks?: string
            }
            predictionEligible?: boolean
          }
        }[]
      >`
        select result
        from metric_rollups
        where run_id = ${run!.id} and metric_key = 'dataSufficiency'
      `
      expect(sufficiency?.result).toMatchObject({
        inputs: {
          historyWeeks: '1',
          predictionHistoryWeeks: '4',
        },
        predictionEligible: false,
      })

      const itemMetrics = await sql<
        {
          metricKey: string
          status: 'calculated' | 'cannot-calculate'
          value: string | null
          result: Record<string, unknown>
        }[]
      >`
        select metric_key as "metricKey", status, value, result
        from metric_results
        where run_id = ${run!.id}
          and inventory_item_id is not null
      `
      const findings = buildPartialDataFindings({
        metrics: itemMetrics,
        unit: 'each',
        currentDate: new Date('2025-01-15T12:00:00.000Z'),
        sales: partialDataLocationFixture.sales.map((sale) => ({
          qty: sale.qty,
          transactedAt: new Date(sale.transactedAt),
        })),
        quantities: [],
      })
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'insufficient-history',
            message:
              'There are 1 week of transaction history here, so this is an observation rather than a prediction.',
            details: expect.objectContaining({
              requiredHistoryWeeks: '4',
              supply: 'Add 4 weeks of transactions to enable a prediction.',
            }),
          }),
        ]),
      )
    }, 120_000)

    it('carries imported purchase costs into exact recipe plate-cost history', async () => {
      const csv = await readFile(
        path.resolve(
          'tests/fixtures/csv/purchase-orders/sysco-invoice-export.csv',
        ),
        'utf8',
      )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'sysco-invoice-export.csv',
        mapping: PURCHASE_ORDER_MAPPING,
        source: 'purchase_orders',
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        PURCHASE_ORDER_RESOLUTIONS,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(4)

      const { sql } = opened!.database
      const purchaseLines = await sql<
        { itemName: string; unitCost: string; totalCost: string }[]
      >`
        select
          purchase_order_items.raw_item_name as "itemName",
          purchase_order_items.unit_cost as "unitCost",
          purchase_order_items.total_cost as "totalCost"
        from purchase_order_items
        inner join purchase_orders
          on purchase_orders.id = purchase_order_items.purchase_order_id
        where purchase_orders.location_id = ${LOCATION_ID}
        order by purchase_orders.ordered_at, purchase_order_items.created_at
      `
      expect(purchaseLines).toEqual([
        { itemName: 'Salmon Fillet', unitCost: '12', totalCost: '240' },
        { itemName: 'Romaine Lettuce', unitCost: '3.5', totalCost: '35' },
        { itemName: 'Salmon Fillet', unitCost: '12.25', totalCost: '183.75' },
        { itemName: 'Tomato', unitCost: '1.8', totalCost: '45' },
      ])

      const importedItems = await sql<{ id: string; canonicalName: string }[]>`
        select id, canonical_name as "canonicalName"
        from inventory_items
        where location_id = ${LOCATION_ID}
          and canonical_name in ('salmon fillet', 'romaine lettuce')
      `
      const salmon = importedItems.find(
        (item) => item.canonicalName === 'salmon fillet',
      )
      const romaine = importedItems.find(
        (item) => item.canonicalName === 'romaine lettuce',
      )
      const [menuItem] = await sql<{ id: string }[]>`
        insert into inventory_items
          (location_id, canonical_name, display_name, unit, item_type, menu_price)
        values
          (${LOCATION_ID}, 'salmon plate', 'Salmon plate', 'each', 'menu_item', '20')
        returning id
      `
      expect(salmon?.canonicalName).toBe('salmon fillet')
      expect(romaine?.canonicalName).toBe('romaine lettuce')
      if (!menuItem || !salmon || !romaine)
        throw new Error('Recipe fixture items were not imported.')

      const salmonItemId = salmon.id
      const romaineItemId = romaine.id
      await sql`
        update inventory_items
        set cost_per_unit = case id
          when ${salmonItemId} then ${'12.00'}::numeric
          when ${romaineItemId} then ${'3.50'}::numeric
        end
        where id in (${salmonItemId}, ${romaineItemId})
      `

      const { saveRecipe } =
        await import('../../src/server/menu/recipe-builder')
      const recipe = await saveRecipe(new Headers(), LOCATION_ID, {
        menuItemId: menuItem.id,
        name: 'Salmon plate',
        outputQuantity: '4',
        outputUnit: 'each',
        ingredients: [
          { ingredientItemId: salmonItemId, quantity: '1', unit: 'lb' },
          { ingredientItemId: romaineItemId, quantity: '2', unit: 'lb' },
        ],
      })

      await sql`
        update inventory_items
        set cost_per_unit = '12.25'
        where id = ${salmonItemId}
      `
      await saveRecipe(
        new Headers(),
        LOCATION_ID,
        {
          menuItemId: menuItem.id,
          name: 'Salmon plate',
          outputQuantity: '4',
          outputUnit: 'each',
          ingredients: [
            { ingredientItemId: salmonItemId, quantity: '1', unit: 'lb' },
            { ingredientItemId: romaineItemId, quantity: '2', unit: 'lb' },
          ],
        },
        recipe.id,
      )

      const history = await sql<
        {
          status: string
          batchCost: string | null
          costPerOutput: string | null
          plateMargin: string | null
          foodCostPercentage: string | null
          evidence: {
            batch: { lines: { cost: string | null }[] }
            plate: { effectiveOutputQuantity: string | null }
          }
        }[]
      >`
        select
          status,
          batch_cost as "batchCost",
          cost_per_output as "costPerOutput",
          plate_margin as "plateMargin",
          food_cost_percentage as "foodCostPercentage",
          evidence
        from recipe_cost_history
        where recipe_id = ${recipe.id}
        order by calculated_at, id
      `

      expect(history).toHaveLength(2)
      expect(history).toMatchObject([
        {
          status: 'complete',
          batchCost: '19',
          costPerOutput: '4.75',
          plateMargin: '15.25',
          foodCostPercentage: '23.75',
          evidence: {
            batch: { lines: [{ cost: '12' }, { cost: '7' }] },
            plate: { effectiveOutputQuantity: '4' },
          },
        },
        {
          status: 'complete',
          batchCost: '19.25',
          costPerOutput: '4.8125',
          plateMargin: '15.1875',
          foodCostPercentage: '24.0625',
          evidence: {
            batch: { lines: [{ cost: '12.25' }, { cost: '7' }] },
            plate: { effectiveOutputQuantity: '4' },
          },
        },
      ])
    }, 120_000)

    it('nets refunds in revenue without turning them into negative waste', async () => {
      const csv = await readFile(
        path.resolve(
          'tests/fixtures/csv/transactions/sales-with-refunds-negative.csv',
        ),
        'utf8',
      )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-with-refunds-negative.csv',
        mapping: REFUNDS_MAPPING,
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        REFUNDS_RESOLUTIONS,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(5)

      const { sql } = opened!.database
      const totals = await sql<
        { itemName: string; qty: string; revenue: string }[]
      >`
        select
          raw_item_name as "itemName",
          sum(qty)::text as qty,
          sum(total_revenue)::text as revenue
        from transactions
        where location_id = ${LOCATION_ID}
        group by raw_item_name
        order by raw_item_name
      `
      expect(totals).toEqual([
        { itemName: 'House Salad', qty: '4', revenue: '44' },
        { itemName: 'Salmon Fillet', qty: '0', revenue: '0' },
        { itemName: 'Tomato Soup', qty: '4', revenue: '34' },
      ])

      const { runPrecomputeForLocation } =
        await import('../../src/server/metrics/precompute')
      const run = await runPrecomputeForLocation(LOCATION_ID, {
        now: new Date('2025-03-04T12:00:00.000Z'),
      })
      expect(run?.status).toBe('succeeded')

      const metrics = await sql<
        {
          itemName: string
          metricKey: string
          value: string | null
          result: {
            inputs?: { qtySold?: string; revenue?: string }
            resolution?: { figures?: { value: string }[] }
          }
        }[]
      >`
        select
          inventory_items.display_name as "itemName",
          metric_key as "metricKey",
          value,
          result
        from metric_results
        inner join inventory_items
          on inventory_items.id = metric_results.inventory_item_id
        where run_id = ${run!.id}
          and metric_key in ('margin', 'spoilageEstimate')
        order by inventory_items.display_name, metric_key
      `

      const marginByItem = new Map(
        metrics
          .filter((metric) => metric.metricKey === 'margin')
          .map((metric) => [metric.itemName, metric.result.inputs]),
      )
      expect(marginByItem.get('House Salad')).toMatchObject({
        qtySold: '4',
        revenue: '44',
      })
      expect(marginByItem.get('Salmon Fillet')).toMatchObject({
        qtySold: '0',
        revenue: '0',
      })

      const spoilageMetrics = metrics.filter(
        (metric) => metric.metricKey === 'spoilageEstimate',
      )
      expect(spoilageMetrics).toHaveLength(3)
      expect(spoilageMetrics.every((metric) => metric.value === null)).toBe(
        true,
      )
      const spoilageValues = spoilageMetrics.flatMap((metric) => [
        ...(metric.value === null ? [] : [metric.value]),
        ...(metric.result.resolution?.figures?.map((figure) => figure.value) ??
          []),
      ])
      expect(spoilageValues.every((value) => !value.startsWith('-'))).toBe(true)
    }, 120_000)

    it('assigns a 01:30 sale to the prior business day after import and precompute', async () => {
      const csv = await readFile(
        path.resolve(
          'tests/fixtures/csv/transactions/sales-business-day-boundary.csv',
        ),
        'utf8',
      )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-business-day-boundary.csv',
        mapping: BUSINESS_DAY_MAPPING,
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        BUSINESS_DAY_RESOLUTIONS,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(2)

      const { runPrecomputeForLocation } =
        await import('../../src/server/metrics/precompute')
      const run = await runPrecomputeForLocation(LOCATION_ID, {
        now: new Date('2026-01-03T12:00:00.000Z'),
      })
      expect(run?.status).toBe('succeeded')

      const { sql } = opened!.database
      const [forecast] = await sql<
        {
          result: { forecast: { historyDays: number } }
        }[]
      >`
        select result
        from metric_rollups
        where run_id = ${run!.id} and metric_key = 'demandForecast'
      `
      expect(forecast?.result.forecast.historyDays).toBe(2)

      const { getDashboardDataState } =
        await import('../../src/server/metrics/dashboard-state')
      await expect(
        getDashboardDataState(new Headers(), LOCATION_ID),
      ).resolves.toMatchObject({
        transactionDays: 2,
        status: 'insufficient',
      })
    }, 120_000)

    it('keeps money exact from imported rows through metrics to the rendered figure', async () => {
      const csv = await readFile(
        path.resolve(
          'tests/fixtures/csv/transactions/sales-money-precision.csv',
        ),
        'utf8',
      )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-money-precision.csv',
        mapping: MONEY_PRECISION_MAPPING,
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        MONEY_PRECISION_RESOLUTIONS,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(2)

      const { sql } = opened!.database
      const imported = await sql<
        { unitPrice: string; totalRevenue: string; totalCost: string | null }[]
      >`
        select
          unit_price as "unitPrice",
          total_revenue as "totalRevenue",
          total_cost as "totalCost"
        from transactions
        where location_id = ${LOCATION_ID}
        order by transacted_at
      `
      expect(imported).toEqual([
        { unitPrice: '0.1', totalRevenue: '0.1', totalCost: '0.01' },
        { unitPrice: '0.2', totalRevenue: '0.2', totalCost: '0.02' },
      ])

      const [item] = await sql<{ id: string }[]>`
        select id from inventory_items
        where location_id = ${LOCATION_ID} and canonical_name = 'tomato soup'
      `
      await sql`
        update inventory_items
        set cost_per_unit = '0.03'
        where id = ${item!.id}
      `

      const { runPrecomputeForLocation } =
        await import('../../src/server/metrics/precompute')
      const run = await runPrecomputeForLocation(LOCATION_ID, {
        now: new Date('2026-08-10T12:00:00.000Z'),
      })
      expect(run?.status).toBe('succeeded')

      const [margin] = await sql<
        {
          value: string | null
          result: { inputs?: { revenue?: string } }
        }[]
      >`
        select value, result
        from metric_results
        where run_id = ${run!.id}
          and metric_key = 'margin'
      `
      expect(margin).toMatchObject({
        value: '0.24',
        result: { inputs: { revenue: '0.3' } },
      })

      const { buildTrendSummaries } =
        await import('../../src/server/metrics/trends')
      const summaries = buildTrendSummaries([
        { label: 'Aug 3–Aug 9', margin: margin!.value!, unit: 'each' },
      ])
      const markup = renderToStaticMarkup(
        createElement(TrendSummaries, { summaries }),
      )
      expect(markup).toContain('$0.24')
    }, 120_000)

    it('carries imported labor into exact STF-02 efficiency metrics', async () => {
      const { sql } = opened!.database
      await sql`
        update locations
        set timezone = 'UTC'
        where id = ${LOCATION_ID}
      `

      const laborCsv = (
        await readFile(
          path.resolve('tests/fixtures/csv/labor/homebase-timesheet.csv'),
          'utf8',
        )
      ).replaceAll('2025-03-', '2026-08-')
      const laborUploadId = await seedUpload(LOCATION_ID, {
        filename: 'homebase-timesheet.csv',
        mapping: LABOR_MAPPING,
        source: 'labor',
      })
      const laborSummary = await imports.commitCsvImport(
        new Headers(),
        laborUploadId,
        undefined,
        memoryStorage(laborCsv),
      )
      expect(laborSummary.rowsImported).toBe(3)

      const salesUploadId = await seedUpload(LOCATION_ID, {
        filename: 'staffing-sales.csv',
        mapping: STAFFING_SALES_MAPPING,
      })
      const salesSummary = await imports.commitCsvImport(
        new Headers(),
        salesUploadId,
        STAFFING_SALES_RESOLUTIONS,
        memoryStorage(STAFFING_SALES_CSV),
      )
      expect(salesSummary.rowsImported).toBe(2)

      const { getLaborEfficiency } =
        await import('../../src/server/staffing/labor-efficiency-query')
      const result = await getLaborEfficiency(new Headers(), LOCATION_ID)
      const shifts = result.periods.filter(
        (period) => period.dimension === 'shift',
      )

      expect(shifts).toHaveLength(2)
      expect(shifts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringContaining('Dishwasher'),
            sales: '240',
            foodCost: '60',
            actualHours: '8',
            laborCost: '120',
            scheduledActualVariance: null,
            salesPerLaborHour: expect.objectContaining({
              status: 'calculated',
              value: '30',
            }),
            laborCostPercentage: expect.objectContaining({
              status: 'calculated',
              value: '50',
            }),
            primeCost: expect.objectContaining({
              status: 'calculated',
              value: '180',
            }),
            primeCostPercentage: expect.objectContaining({
              status: 'calculated',
              value: '75',
            }),
          }),
          expect.objectContaining({
            label: expect.stringContaining('Bartender'),
            sales: '160',
            foodCost: '40',
            actualHours: '8',
            laborCost: '160',
            scheduledActualVariance: null,
            salesPerLaborHour: expect.objectContaining({
              status: 'calculated',
              value: '20',
            }),
            laborCostPercentage: expect.objectContaining({
              status: 'calculated',
              value: '100',
            }),
            primeCost: expect.objectContaining({
              status: 'calculated',
              value: '200',
            }),
            primeCostPercentage: expect.objectContaining({
              status: 'calculated',
              value: '125',
            }),
          }),
        ]),
      )
      expect(
        result.exclusions.some(
          (exclusion) =>
            exclusion.dimension === 'shift' &&
            exclusion.reason === 'No sales data for this period.',
        ),
      ).toBe(true)
    }, 120_000)

    it('marks the upload imported so the history is honest', async () => {
      const uploadId = await seedUpload()
      await imports.commitCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      const { sql } = opened!.database
      const [row] = await sql<{ status: string; rows_imported: number }[]>`
        select status, rows_imported from csv_upload_history where id = ${uploadId}
      `
      expect(row?.status).toBe('imported')
      expect(row?.rows_imported).toBe(2)
    })

    it('writes nothing at all when the file cannot be read', async () => {
      const uploadId = await seedUpload()
      const brokenStorage: ObjectStorage = {
        putObject: async () => {},
        deleteObject: async () => {},
        getObject: async () => {
          throw new Error('S3 timeout')
        },
      }

      await expect(
        imports.commitCsvImport(
          new Headers(),
          uploadId,
          RESOLUTIONS,
          brokenStorage,
        ),
      ).rejects.toThrow()

      expect(await countTransactions()).toBe(0)
      expect(await countItems()).toBe(0)
    })

    it('leaves no partial rows behind when one row is unparseable', async () => {
      const uploadId = await seedUpload()
      const badCsv = [
        'Date,Item,Quantity,Unit price,Total',
        '2026-08-01T18:00:00Z,Salmon,2,24.00,48.00',
        'not-a-date,Potato,five,2.00,10.00',
        '',
      ].join('\n')

      const before = await countTransactions()
      await imports
        .commitCsvImport(
          new Headers(),
          uploadId,
          RESOLUTIONS,
          memoryStorage(badCsv),
        )
        .catch(() => undefined)

      // Either the whole file imports or none of it does. A half-imported day
      // silently understates revenue.
      const after = await countTransactions()
      expect(after === before || after === 2).toBe(true)
    })

    it('does not double-count a file committed twice', async () => {
      const uploadId = await seedUpload()
      await imports.commitCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      const second = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      expect(await countTransactions()).toBe(2)
      expect(second.alreadyImported).toBe(true)
    })

    it('deduplicates the same file uploaded twice as separate imports', async () => {
      const firstUploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-retry.csv',
      })
      const secondUploadId = await seedUpload(LOCATION_ID, {
        filename: 'sales-retry.csv',
      })

      const first = await imports.commitCsvImport(
        new Headers(),
        firstUploadId,
        RESOLUTIONS,
        memoryStorage(),
      )
      const second = await imports.commitCsvImport(
        new Headers(),
        secondUploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      expect(first.rowsImported).toBe(2)
      expect(second.rowsImported).toBe(0)
      expect(second.alreadyImported).toBe(false)
      expect(await countTransactions()).toBe(2)
      expect(await countItems()).toBe(2)
    })

    it('refuses to commit into another account location', async () => {
      const uploadId = await seedUpload(OTHER_LOCATION_ID)

      await expect(
        imports.commitCsvImport(
          new Headers(),
          uploadId,
          RESOLUTIONS,
          memoryStorage(),
        ),
      ).rejects.toThrow()

      expect(await countTransactions(OTHER_LOCATION_ID)).toBe(0)
    })

    it('reuses an existing item rather than creating a duplicate', async () => {
      const { sql } = opened!.database
      await sql`
        insert into inventory_items (location_id, canonical_name, display_name, unit)
        values (${LOCATION_ID}, 'salmon', 'Salmon', 'lb')
      `

      const uploadId = await seedUpload()
      await imports.commitCsvImport(
        new Headers(),
        uploadId,
        RESOLUTIONS,
        memoryStorage(),
      )

      // Salmon already existed, so only Potato is new.
      expect(await countItems()).toBe(2)
    })
  })

  describe('history', () => {
    it('lists only the caller own imports', async () => {
      await seedUpload()
      await seedUpload(OTHER_LOCATION_ID)

      const history = await imports.listImportHistory(
        new Headers(),
        LOCATION_ID,
      )

      expect(history).toHaveLength(1)
    })

    it('refuses history for another account location', async () => {
      await expect(
        imports.listImportHistory(new Headers(), OTHER_LOCATION_ID),
      ).rejects.toThrow()
    })
  })

  describe('account isolation', () => {
    it('keeps an upload and every read surface private to its owner', async () => {
      const storage = new MemoryObjectStorage()
      const byteLength = new TextEncoder().encode(CSV).byteLength
      const upload = await uploads.uploadCsv({
        headers: new Headers({ 'content-length': String(byteLength) }),
        locationId: LOCATION_ID,
        filename: 'sales.csv',
        importType: 'transactions',
        body: csvBody(CSV),
        storage,
      })

      await mappings.saveCsvMapping(new Headers(), upload.id, MAPPING)
      await imports.commitCsvImport(
        new Headers(),
        upload.id,
        RESOLUTIONS,
        storage,
      )
      expect(await countTransactions(LOCATION_ID)).toBe(2)

      sessionState.current = { user: { id: OTHER_OWNER_ID } }

      await expect(
        imports.listImportHistory(new Headers(), LOCATION_ID),
      ).rejects.toThrow()
      await expect(
        imports.previewCsvImport(
          new Headers(),
          upload.id,
          RESOLUTIONS,
          storage,
        ),
      ).rejects.toThrow()
      await expect(
        previews.previewCsv(new Headers(), upload.id, storage),
      ).rejects.toThrow()
      await expect(
        mappings.saveCsvMapping(new Headers(), upload.id, MAPPING),
      ).rejects.toThrow()
      await expect(
        exportsService.exportLocationCsv(
          new Headers(),
          LOCATION_ID,
          'transactions',
        ),
      ).rejects.toThrow()
    })
  })

  describe('export service', () => {
    it('keeps the formula-injection fixture inert through import and export', async () => {
      const csv = await readFile(
        path.resolve('tests/fixtures/csv/security/formula-injection.csv'),
        'utf8',
      )
      const itemNames = [
        '=HYPERLINK("http://evil.example")',
        '+1+1',
        '@SUM(A1:A2)',
        '-2+3',
        'House Salad',
      ]
      const resolutions: Record<string, ImportItemResolution> =
        Object.fromEntries(
          itemNames.map((displayName) => [
            normalizeExactItemName(displayName),
            {
              canonicalName: normalizeExactItemName(displayName),
              displayName,
              category: 'test',
              unit: 'each',
              shelfLifeDays: null,
            },
          ]),
        )
      const uploadId = await seedUpload(LOCATION_ID, {
        filename: 'formula-injection.csv',
        mapping: {
          Date: 'transactedAt',
          'Item Name': 'rawItemName',
          Qty: 'qty',
          'Total Revenue': 'totalRevenue',
        },
      })

      const summary = await imports.commitCsvImport(
        new Headers(),
        uploadId,
        resolutions,
        memoryStorage(csv),
      )

      expect(summary.rowsImported).toBe(5)

      const exported = await exportsService.exportLocationCsv(
        new Headers(),
        LOCATION_ID,
        'transactions',
      )
      expect(exported).toContain('\'=HYPERLINK(""http://evil.example"")')
      expect(exported).toContain("'+1+1")
      expect(exported).toContain("'@SUM(A1:A2)")
      expect(exported).toContain("'-2+3")
      expect(exported).not.toContain(',=HYPERLINK(')
      expect(exported).not.toContain(',+1+1,')
      expect(exported).not.toContain(',@SUM(A1:A2),')
      expect(exported).not.toContain(',-2+3,')
    })

    it('scopes every dataset to the owner and neutralizes formula-looking cells', async () => {
      const { sql } = opened!.database
      const itemId = '00000000-0000-4000-8000-00000000e001'
      const orderId = '00000000-0000-4000-8000-00000000e002'
      const orderItemId = '00000000-0000-4000-8000-00000000e003'
      const snapshotId = '00000000-0000-4000-8000-00000000e004'

      await sql`
        insert into inventory_items
          (id, location_id, canonical_name, display_name, category, unit,
           shelf_life_days, cost_per_unit, menu_price, par_level)
        values
          (
            ${itemId}, ${LOCATION_ID}, 'formula item',
            '=HYPERLINK("http://evil.example")', '@SUM(A1:A2)', 'each',
            3, '8.50', '18.00', '4.00'
          )
      `
      await sql`
        insert into transactions
          (id, location_id, transacted_at, external_id, source,
           menu_item_id, raw_item_name, category, qty, unit_price,
           total_revenue, total_cost, gross_margin)
        values
          (
            '00000000-0000-4000-8000-00000000e005', ${LOCATION_ID},
            '2026-08-08T04:00:00Z', 'formula-sale', 'test', ${itemId},
            '=HYPERLINK("http://evil.example")', '+1+1', '2', '24.00',
            '48.00', '12.50', '35.50'
          ),
          (
            '00000000-0000-4000-8000-00000000e006', ${OTHER_LOCATION_ID},
            '2026-08-08T05:00:00Z', 'other-sale', 'test', null,
            'Other location item', 'Other', '1', '9.00',
            '9.00', '4.00', '5.00'
          )
      `
      await sql`
        insert into purchase_orders
          (id, location_id, ordered_at, received_at, external_id, source,
           supplier_name)
        values
          (
            ${orderId}, ${LOCATION_ID}, '2026-08-07T04:00:00Z',
            '2026-08-08T04:00:00Z', '+1+1', 'test', '@SUM(A1:A2)'
          )
      `
      await sql`
        insert into purchase_order_items
          (id, purchase_order_id, location_id, inventory_item_id,
           raw_item_name, qty, unit_cost, total_cost)
        values
          (
            ${orderItemId}, ${orderId}, ${LOCATION_ID}, ${itemId},
            '=HYPERLINK("http://evil.example")', '2', '8.50', '17.00'
          )
      `
      await sql`
        insert into inventory_snapshots
          (id, location_id, inventory_item_id, counted_at, qty, source)
        values
          (
            ${snapshotId}, ${LOCATION_ID}, ${itemId},
            '2026-08-08T04:00:00Z', '2', 'test'
          )
      `

      const headers = new Headers()
      const transactions = await exportsService.exportLocationCsv(
        headers,
        LOCATION_ID,
        'transactions',
      )
      expect(transactions).toContain('\'=HYPERLINK(""http://evil.example"")')
      expect(transactions).toContain("'+1+1")
      expect(transactions).not.toContain(',other-sale,')

      const purchaseOrders = await exportsService.exportLocationCsv(
        headers,
        LOCATION_ID,
        'purchase_orders',
      )
      expect(purchaseOrders).toContain(",'+1+1,")
      expect(purchaseOrders).toContain("'@SUM(A1:A2)")

      const inventoryItems = await exportsService.exportLocationCsv(
        headers,
        LOCATION_ID,
        'inventory_items',
      )
      expect(inventoryItems).toContain('\'=HYPERLINK(""http://evil.example"")')
      expect(inventoryItems).toContain("'@SUM(A1:A2)")

      const inventorySnapshots = await exportsService.exportLocationCsv(
        headers,
        LOCATION_ID,
        'inventory_snapshots',
      )
      expect(inventorySnapshots).toContain(snapshotId)
      expect(inventorySnapshots).toContain(
        '\'=HYPERLINK(""http://evil.example"")',
      )

      sessionState.current = { user: { id: OTHER_OWNER_ID } }
      const otherTransactions = await exportsService.exportLocationCsv(
        headers,
        OTHER_LOCATION_ID,
        'transactions',
      )
      expect(otherTransactions).toContain(',other-sale,')
      expect(otherTransactions).not.toContain('formula-sale')
    })
  })
})
