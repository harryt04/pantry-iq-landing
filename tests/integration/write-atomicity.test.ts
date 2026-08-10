import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

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

/**
 * Replaces the string assertions the 2026-08-10 audit found in
 * tests/csv-import-contract.test.ts and tests/manual-entry-contract.test.ts,
 * which checked that the characters `db.transaction` appeared in a source file.
 *
 * The property that actually matters is that a failure part-way through a write
 * leaves nothing behind. That is only observable against a real database, so
 * these tests run the write and then count rows.
 */

const OWNER_ID = '00000000-0000-4000-8000-00000000c001'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c002'
const LOCATION_ID = '00000000-0000-4000-8000-00000000d001'
const OTHER_LOCATION_ID = '00000000-0000-4000-8000-00000000d002'
const ITEM_ID = '00000000-0000-4000-8000-00000000e001'
const OTHER_ITEM_ID = '00000000-0000-4000-8000-00000000e002'
const SETUP_TIMEOUT_MS = 120_000

let opened: OpenTestDatabase | undefined
let previousDatabaseUrl: string | undefined
let db: typeof import('../../src/server/db/client').db
let persistence: typeof import('../../src/server/ingestion/persistence')
let records: typeof import('../../src/server/ingestion/records')

function transactionRecord(externalId: string, qty = '2') {
  return records.normalizeTransaction({
    source: 'csv',
    externalId,
    transactedAt: new Date('2026-08-01T18:00:00.000Z'),
    itemId: ITEM_ID,
    rawItemName: 'Salmon',
    category: 'seafood',
    qty,
    unitPrice: '24.00',
    totalRevenue: '48.00',
    totalCost: '19.00',
    grossMargin: '29.00',
  })
}

describe.skipIf(!integrationDatabaseEnabled())('write atomicity', () => {
  beforeAll(async () => {
    opened = await openTestDatabase()
    const { sql, url } = opened.database

    await rollbackDatabase(sql)
    await migrateDatabase(sql)

    previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = url
    db = (await import('../../src/server/db/client')).db
    persistence = await import('../../src/server/ingestion/persistence')
    records = await import('../../src/server/ingestion/records')
  }, SETUP_TIMEOUT_MS)

  afterAll(async () => {
    // Close the app pool before the env is restored and before the container
    // stops, or its idle connections raise after the suite has passed.
    await closeAppDatabaseClient()
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await opened?.close()
  })

  beforeEach(async () => {
    const { sql } = opened!.database
    await sql`delete from transactions`
    await sql`delete from inventory_snapshots`
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
    await sql`
      insert into inventory_items (id, location_id, canonical_name, display_name, unit)
      values
        (${ITEM_ID}, ${LOCATION_ID}, 'salmon', 'Salmon', 'lb'),
        (${OTHER_ITEM_ID}, ${OTHER_LOCATION_ID}, 'salmon', 'Salmon', 'lb')
    `
  })

  async function countTransactions(locationId = LOCATION_ID) {
    const { sql } = opened!.database
    const [row] = await sql<{ count: string }[]>`
      select count(*)::text as count from transactions where location_id = ${locationId}
    `
    return Number(row?.count ?? 0)
  }

  it('persists rows the caller transaction commits', async () => {
    await db.transaction(async (tx) => {
      await persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1'),
        transactionRecord('sale-2'),
      ])
    })

    expect(await countTransactions()).toBe(2)
  })

  it('leaves nothing behind when the caller transaction fails afterwards', async () => {
    // This is the real content of "the import is atomic". A source-text test
    // that greps for `db.transaction` passes even if the writes commit early.
    await expect(
      db.transaction(async (tx) => {
        await persistence.persistNormalizedRecords(tx, LOCATION_ID, [
          transactionRecord('sale-1'),
          transactionRecord('sale-2'),
        ])
        throw new Error('the import failed after the rows were written')
      }),
    ).rejects.toThrow('the import failed after the rows were written')

    expect(await countTransactions()).toBe(0)
  })

  it('rolls back every row when one record in the batch is invalid', async () => {
    const badRecord = {
      ...transactionRecord('sale-bad'),
      // A menu item that belongs to no location violates the foreign key.
      itemId: '00000000-0000-4000-8000-0000000000ff',
    }

    await expect(
      db.transaction(async (tx) => {
        await persistence.persistNormalizedRecords(tx, LOCATION_ID, [
          transactionRecord('sale-1'),
        ])
        await persistence.persistNormalizedRecords(tx, LOCATION_ID, [badRecord])
      }),
    ).rejects.toThrow()

    expect(await countTransactions()).toBe(0)
  })

  it('reports how many rows it actually wrote, not how many it was handed', async () => {
    const result = await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1'),
        transactionRecord('sale-2'),
      ]),
    )

    expect(result.rowsImported).toBe(2)
  })

  it('ignores a repeat of the same source and external id', async () => {
    await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1'),
      ]),
    )

    const second = await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1', '99'),
        transactionRecord('sale-2'),
      ]),
    )

    // Re-importing the same file must not double-count revenue.
    expect(second.rowsImported).toBe(1)
    expect(await countTransactions()).toBe(2)

    const { sql } = opened!.database
    const [repeated] = await sql<{ qty: string }[]>`
      select qty from transactions where external_id = 'sale-1'
    `
    // The original quantity survives; the repeat did not overwrite it with 99.
    expect(Number(repeated?.qty)).toBe(2)
  })

  it('writes only to the location it was given', async () => {
    await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1'),
      ]),
    )

    expect(await countTransactions(LOCATION_ID)).toBe(1)
    expect(await countTransactions(OTHER_LOCATION_ID)).toBe(0)
  })

  it('treats the same external id at two locations as two distinct rows', async () => {
    await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, LOCATION_ID, [
        transactionRecord('sale-1'),
      ]),
    )
    await db.transaction(async (tx) =>
      persistence.persistNormalizedRecords(tx, OTHER_LOCATION_ID, [
        {
          ...transactionRecord('sale-1'),
          itemId: OTHER_ITEM_ID,
        },
      ]),
    )

    expect(await countTransactions(LOCATION_ID)).toBe(1)
    expect(await countTransactions(OTHER_LOCATION_ID)).toBe(1)
  })
})
