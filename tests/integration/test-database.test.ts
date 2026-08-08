import { describe, expect, it } from 'vitest'

import { fullYearLocationFixture } from '../fixtures/pantry'
import { withTestDatabase } from '../helpers/test-database'

const testcontainersEnabled = process.env.TESTCONTAINERS_ENABLED === '1'

describe.skipIf(!testcontainersEnabled)(
  'PostgreSQL integration harness',
  () => {
    it('round-trips a reusable full-year fixture through real PostgreSQL', async () => {
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
    })
  },
)
