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

async function seedUsageData(
  client: ReturnType<typeof postgres>,
  fixture: LocationFixture,
  usageEnd: Date,
) {
  const menuItems = await client.unsafe<{ id: string }[]>(
    `
      select id
      from inventory_items
      where location_id = $1
        and canonical_name = 'tomato soup'
      limit 1
    `,
    [fixture.locationId],
  )
  const menuItemId = menuItems[0]?.id
  if (!menuItemId)
    throw new Error('The usage fixture menu item was not seeded.')

  const ingredientItemId = randomUUID()
  const recipeId = randomUUID()
  await client`
    insert into inventory_items (
      id,
      location_id,
      canonical_name,
      display_name,
      category,
      unit,
      item_type,
      cost_per_unit
    ) values (
      ${ingredientItemId},
      ${fixture.locationId},
      'tomato',
      'Tomato',
      'fixture',
      'each',
      'ingredient',
      '1.00'
    )
  `
  await client`
    insert into recipes (
      id,
      location_id,
      menu_item_id,
      name,
      output_quantity,
      output_unit,
      yield_factor,
      waste_factor
    ) values (
      ${recipeId},
      ${fixture.locationId},
      ${menuItemId},
      'Tomato soup recipe',
      '1',
      'each',
      '1',
      '0'
    )
  `
  await client`
    insert into recipe_ingredients (
      id,
      recipe_id,
      ingredient_item_id,
      quantity,
      unit
    ) values (
      ${randomUUID()},
      ${recipeId},
      ${ingredientItemId},
      '1',
      'each'
    )
  `
  await client`
    insert into recipe_cost_history (
      id,
      location_id,
      recipe_id,
      calculated_at,
      status,
      batch_cost,
      cost_per_output,
      menu_price,
      plate_margin,
      food_cost_percentage,
      evidence
    ) values (
      ${randomUUID()},
      ${fixture.locationId},
      ${recipeId},
      ${usageEnd.toISOString()},
      'complete',
      '1.00',
      '1.00',
      '10.00',
      '9.00',
      '10.00',
      ${JSON.stringify({ source: 'e2e-fixture' })}::jsonb
    )
  `

  if (fixture.sales.length >= 365) {
    const beginning = new Date(usageEnd)
    beginning.setUTCDate(beginning.getUTCDate() - 14)
    const purchaseOrderId = randomUUID()
    await client`
      insert into purchase_orders (
        id,
        location_id,
        ordered_at,
        received_at,
        external_id,
        source,
        supplier_name
      ) values (
        ${purchaseOrderId},
        ${fixture.locationId},
        ${new Date(usageEnd.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()},
        ${new Date(usageEnd.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()},
        ${`usage-fixture-po-${fixture.locationId}`},
        'e2e-fixture',
        'Usage fixture supplier'
      )
    `
    await client`
      insert into purchase_order_items (
        id,
        purchase_order_id,
        location_id,
        inventory_item_id,
        raw_item_name,
        qty,
        unit_cost,
        total_cost
      ) values (
        ${randomUUID()},
        ${purchaseOrderId},
        ${fixture.locationId},
        ${ingredientItemId},
        'Tomato',
        '20',
        '1.00',
        '20.00'
      )
    `
    await client`
      insert into inventory_snapshots (
        id,
        location_id,
        inventory_item_id,
        counted_at,
        qty,
        source
      ) values
        (
          ${randomUUID()},
          ${fixture.locationId},
          ${ingredientItemId},
          ${beginning.toISOString()},
          '40',
          'e2e-fixture'
        ),
        (
          ${randomUUID()},
          ${fixture.locationId},
          ${ingredientItemId},
          ${usageEnd.toISOString()},
          '15',
          'e2e-fixture'
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
    await seedUsageData(client, recentFullYearFixture, new Date())
    await seedUsageData(client, recentPartialDataFixture, new Date())
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
        snapshotCount: '54',
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
