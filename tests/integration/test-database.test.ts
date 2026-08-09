import { describe, expect, it } from 'vitest'

import { fullYearLocationFixture } from '../fixtures/pantry'
import {
  integrationDatabaseEnabled,
  withTestDatabase,
} from '../helpers/test-database'

// Starting a disposable real PostgreSQL database routinely exceeds Vitest's
// five-second default timeout on CI runners.
const CONTAINER_TEST_TIMEOUT_MS = 60_000

describe.skipIf(!integrationDatabaseEnabled())(
  'PostgreSQL integration harness',
  () => {
    it(
      'round-trips a reusable full-year fixture through real PostgreSQL',
      async () => {
        await withTestDatabase(async (sql) => {
          await sql`
        create temporary table pantryiq_fixture_locations (
          location_id uuid primary key,
          sales_count integer not null,
          snapshot_count integer not null
        )
      `

          await sql`
        insert into pantryiq_fixture_locations
          (location_id, sales_count, snapshot_count)
        values
          (${fullYearLocationFixture.locationId},
           ${fullYearLocationFixture.sales.length},
           ${fullYearLocationFixture.inventorySnapshots.length})
      `

          const rows = await sql<
            {
              location_id: string
              sales_count: number
              snapshot_count: number
            }[]
          >`
        select location_id, sales_count, snapshot_count
        from pantryiq_fixture_locations
      `

          expect(rows).toEqual([
            {
              location_id: fullYearLocationFixture.locationId,
              sales_count: 365,
              snapshot_count: 52,
            },
          ])
        })
      },
      CONTAINER_TEST_TIMEOUT_MS,
    )
  },
)
