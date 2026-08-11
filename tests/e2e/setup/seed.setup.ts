import { expect, test as setup } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import postgres from 'postgres'

import {
  fullYearLocationFixture,
  type LocationFixture,
  partialDataLocationFixture,
} from '../../fixtures/pantry'
import { seedDatabase } from '../../../src/server/db/seed-database'
import { integrationDatabaseEnabled } from '../../helpers/test-database'

const authFile = path.resolve('tests/.auth/owner.json')

function shiftFixtureToRecent(
  fixture: LocationFixture,
  targetEnd: Date,
): LocationFixture {
  const sourceEnd = new Date(fixture.sales.at(-1)?.transactedAt ?? '')
  const offset = targetEnd.getTime() - sourceEnd.getTime()
  const shift = (value: string) => new Date(value).getTime() + offset

  return {
    ...fixture,
    sales: fixture.sales.map((sale) => ({
      ...sale,
      transactedAt: new Date(shift(sale.transactedAt)).toISOString(),
    })),
    inventorySnapshots: fixture.inventorySnapshots.map((snapshot) => ({
      ...snapshot,
      countedAt: new Date(shift(snapshot.countedAt)).toISOString(),
    })),
  }
}

async function seedLaborShifts(
  client: ReturnType<typeof postgres>,
  fixture: LocationFixture,
) {
  for (const sale of fixture.sales) {
    const start = new Date(sale.transactedAt)
    start.setUTCHours(11, 0, 0, 0)
    const end = new Date(start)
    end.setUTCHours(20, 0, 0, 0)

    await client`
      insert into labor_shifts (
        id,
        location_id,
        shift_start,
        shift_end,
        external_id,
        source,
        role,
        scheduled_hours,
        actual_hours,
        labor_cost
      ) values (
        ${randomUUID()},
        ${fixture.locationId},
        ${start.toISOString()},
        ${end.toISOString()},
        ${`fixture-labor-${sale.externalId}`},
        'e2e-fixture',
        'Cook',
        '8',
        '8',
        '120'
      )
    `
  }
}

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
    const targetEnd = new Date()
    targetEnd.setUTCHours(12, 0, 0, 0)
    const recentFullYearFixture = shiftFixtureToRecent(
      fullYearLocationFixture,
      targetEnd,
    )
    const recentPartialDataFixture = shiftFixtureToRecent(
      partialDataLocationFixture,
      targetEnd,
    )

    await seedDatabase(client, {
      ownerId,
      fixtureLocations: [recentFullYearFixture, recentPartialDataFixture],
    })
    await seedLaborShifts(client, recentFullYearFixture)

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
