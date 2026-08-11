import { expect, test as setup } from '@playwright/test'
import path from 'node:path'
import postgres from 'postgres'

import {
  fullYearLocationFixture,
  partialDataLocationFixture,
} from '../../fixtures/pantry'
import { seedDatabase } from '../../../src/server/db/seed-database'
import { integrationDatabaseEnabled } from '../../helpers/test-database'

const authFile = path.resolve('tests/.auth/owner.json')

setup.use({ storageState: authFile })

setup('seed the shared owner locations', async ({ page }) => {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL
  if (!databaseUrl) {
    integrationDatabaseEnabled()
    throw new Error(
      'A local DATABASE_URL or TEST_DATABASE_URL is required for browser data seeding.',
    )
  }

  const sessionResponse = await page.request.get('/api/auth/get-session')
  expect(sessionResponse.status()).toBe(200)
  const session = (await sessionResponse.json()) as {
    user?: { id?: string }
  } | null
  const ownerId = session?.user?.id
  if (!ownerId || !/^[0-9a-f-]{36}$/i.test(ownerId)) {
    throw new Error('The shared browser session did not return a user id.')
  }

  const client = postgres(databaseUrl, { max: 1 })
  try {
    await seedDatabase(client, {
      ownerId,
      fixtureLocations: [fullYearLocationFixture, partialDataLocationFixture],
    })

    const rows = await client.unsafe<
      {
        locationId: string
        transactionCount: string
        snapshotCount: string
      }[]
    >(
      `
        select
          l.id as "locationId",
          count(distinct t.id)::text as "transactionCount",
          count(distinct s.id)::text as "snapshotCount"
        from locations l
        left join transactions t on t.location_id = l.id
        left join inventory_snapshots s on s.location_id = l.id
        where l.user_id = $1
          and l.id in ($2, $3)
        group by l.id
        order by l.id
      `,
      [
        ownerId,
        fullYearLocationFixture.locationId,
        partialDataLocationFixture.locationId,
      ],
    )

    expect(rows).toEqual([
      {
        locationId: partialDataLocationFixture.locationId,
        transactionCount: '14',
        snapshotCount: '0',
      },
      {
        locationId: fullYearLocationFixture.locationId,
        transactionCount: '365',
        snapshotCount: '52',
      },
    ])

    const locationsResponse = await page.request.get('/api/locations')
    expect(locationsResponse.status()).toBe(200)
    const locationsBody = (await locationsResponse.json()) as {
      locations: { id: string; name: string }[]
    }
    expect(locationsBody.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fullYearLocationFixture.locationId,
          name: 'Full-year data kitchen',
        }),
        expect.objectContaining({
          id: partialDataLocationFixture.locationId,
          name: 'Fourteen-day data kitchen',
        }),
      ]),
    )
  } finally {
    await client.end()
  }
})
