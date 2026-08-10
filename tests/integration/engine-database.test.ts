import { describe, expect, it } from 'vitest'

import {
  migrateDatabase,
  rollbackDatabase,
} from '../../src/server/db/migrations'
import { seedDatabase } from '../../src/server/db/seed-database'
import {
  integrationDatabaseEnabled,
  withTestDatabaseUrl,
} from '../helpers/test-database'

const LOCATION_ID = '00000000-0000-4000-8000-000000000002'
const RUN_TIME = new Date('2026-08-05T12:00:00.000Z')
const TEST_TIMEOUT_MS = 60_000

describe.skipIf(!integrationDatabaseEnabled())(
  'metric engine PostgreSQL integration',
  () => {
    it(
      'runs the production precompute path and stores exact metric evidence',
      async () => {
        const previousDatabaseUrl = process.env.DATABASE_URL

        await withTestDatabaseUrl(async ({ sql, url }) => {
          process.env.DATABASE_URL = url

          try {
            await rollbackDatabase(sql)
            await migrateDatabase(sql)
            await seedDatabase(sql)

            const { getLatestSuccessfulMetricRun, runPrecomputeForLocation } =
              await import('../../src/server/metrics/precompute')
            const run = await runPrecomputeForLocation(LOCATION_ID, {
              now: RUN_TIME,
            })

            expect(run).toMatchObject({
              locationId: LOCATION_ID,
              status: 'succeeded',
              inputWindowStart: new Date('2026-07-01T15:00:00.000Z'),
              inputWindowEnd: new Date('2026-08-04T18:00:00.000Z'),
            })
            if (!run) throw new Error('The metric run was not returned.')

            const [sellThrough] = await sql<
              { status: string; value: string | null; result: unknown }[]
            >`
              select status, value, result
              from metric_rollups
              where run_id = ${run.id} and metric_key = 'sellThrough'
            `

            expect(sellThrough).toMatchObject({
              status: 'calculated',
              value: '174',
            })
            expect(sellThrough?.result).toMatchObject({
              inputs: { qtyOrdered: '100', qtySold: '174' },
              units: { value: '%' },
            })

            const [latestRun, metricRows] = await Promise.all([
              getLatestSuccessfulMetricRun(LOCATION_ID),
              sql`
                select metric_key
                from metric_results
                where run_id = ${run.id}
                order by metric_key
              `,
            ])

            expect(latestRun?.id).toBe(run.id)
            expect(metricRows.map(({ metric_key }) => metric_key)).toEqual(
              expect.arrayContaining([
                'dataSufficiency',
                'impact',
                'margin',
                'recommendation',
                'sellThrough',
                'spoilageEstimate',
                'spoilageRisk',
                'urgency',
                'variance',
              ]),
            )
          } finally {
            if (previousDatabaseUrl === undefined)
              delete process.env.DATABASE_URL
            else process.env.DATABASE_URL = previousDatabaseUrl
          }
        })
      },
      TEST_TIMEOUT_MS,
    )
  },
)
