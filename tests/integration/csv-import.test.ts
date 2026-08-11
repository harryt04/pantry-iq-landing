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

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import {
  closeAppDatabaseClient,
  integrationDatabaseEnabled,
  openTestDatabase,
  type OpenTestDatabase,
} from '../helpers/test-database'
import type { ObjectStorage } from '../../src/server/storage/object-storage'
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
      (${locationId}, ${options.filename ?? 'sales.csv'}, 'transactions', 'uploaded', 0,
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
})
