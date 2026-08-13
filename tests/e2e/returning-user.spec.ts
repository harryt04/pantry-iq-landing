import { expect, test } from '@playwright/test'

import {
  foreignAccountLocationId,
  foreignAccountLocationName,
} from '../fixtures/pantry'

/**
 * The second end-to-end path, added by the 2026-08-10 testing audit.
 *
 * tests/critical-path.spec.ts covers a brand-new account: signup through first
 * import. This one covers the path an operator actually walks every day —
 * signing back in, moving between locations, and getting data back out — which
 * exercises session restore, the location switcher, and the export route
 * together. Keep end-to-end coverage to these two specs; they are slow.
 */

test.describe('explicit signup and returning-user journey', () => {
  test.use({ storageState: undefined })

  test('sign in, switch location, open chat, export CSV', async ({ page }) => {
    const password = 'pantryiq-returning-user-2026'
    const email = `returning-user-${Date.now()}@example.test`

    // Arrange: an account with two locations, created through the real UI so the
    // test never depends on a fixture the product does not produce itself.
    await page.goto('/sign-up')
    await page.getByLabel('Name').fill('Returning Operator')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/welcome$/)
    await expect(
      page.getByRole('heading', { name: 'Start with one location.' }),
    ).toBeVisible()
    const firstLocationName = 'First session kitchen'
    const desktopAction = page.getByRole('button', { name: 'Add location' })
    await expect(desktopAction).toBeEnabled()
    await page.getByLabel('Location name').fill(firstLocationName)
    await page.getByLabel('Address').fill('1 First Street')
    await expect(desktopAction).toBeVisible()
    expect((await desktopAction.boundingBox())?.height).toBeGreaterThanOrEqual(
      44,
    )
    await expect(desktopAction).toBeEnabled()
    await expect(page.getByLabel('Location name')).toHaveValue(
      firstLocationName,
    )
    await desktopAction.click()
    await expect(page).toHaveURL(/\/import\?locationId=/)
    const createdFirstLocationId = new URL(page.url()).searchParams.get(
      'locationId',
    )
    expect(createdFirstLocationId).toBeTruthy()
    await expect(
      page.getByRole('combobox', { name: 'Selected location' }),
    ).toContainText(firstLocationName)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/welcome')
    const mobileAction = page.getByRole('button', { name: 'Add location' })
    await expect(mobileAction).toBeVisible()
    const mobileActionBox = await mobileAction.boundingBox()
    expect(mobileActionBox).not.toBeNull()
    expect(mobileActionBox?.height).toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375)

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/account')

    for (const [name, address] of [
      ['North Kitchen', '1 North Street'],
      ['South Kitchen', '2 South Street'],
    ]) {
      await page.getByLabel('Location name').fill(name!)
      await page.getByLabel('Address').fill(address!)
      await page.getByRole('button', { name: 'Add location' }).click()
      await expect(page.getByRole('status')).toContainText('Location added.')
    }

    // Sign out, then back in. This is the part the critical path never reaches.
    await page.getByRole('button', { name: /Sign out/ }).click()
    await expect(page).toHaveURL(/\/(sign-in)?$/)

    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /Sign in/ }).click()

    await expect(page).toHaveURL(
      new RegExp(`/import\\?locationId=${createdFirstLocationId}`),
    )
    await expect(
      page.getByRole('heading', { name: "Bring in one location's data." }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Start with one location.' }),
    ).toHaveCount(0)

    // The location switcher must actually change the scope in the URL. Navigate
    // through the shell rather than typing /dashboard, because the shell is what
    // attaches the selected location to every link.
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page).toHaveURL(/locationId=/)
    const firstLocationId = new URL(page.url()).searchParams.get('locationId')
    expect(firstLocationId).toBeTruthy()

    await page.getByLabel('Selected location').click()
    await page.getByRole('option', { name: 'South Kitchen' }).click()

    await expect
      .poll(() => new URL(page.url()).searchParams.get('locationId'))
      .not.toBe(firstLocationId)

    const secondLocationId = new URL(page.url()).searchParams.get('locationId')

    // Chat opens against the location that is actually selected.
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page).toHaveURL(new RegExp(`locationId=${secondLocationId}`))
    await expect(
      page.getByText('Answers stay within this location.'),
    ).toBeVisible()

    // Export returns a CSV attachment for that same location, not a JSON error.
    const response = await page.request.get(
      `/api/exports/inventory_items?locationId=${secondLocationId}`,
    )
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('attachment')
    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('account location lifecycle', () => {
  test('creates, renames, and removes a location from the account page', async ({
    page,
  }) => {
    const locationName = `Lifecycle Kitchen ${Date.now()}`
    const renamedLocationName = `${locationName} Renamed`
    let locationId: string | undefined

    try {
      await page.goto('/account')

      await page.getByLabel('Location name').fill(locationName)
      await page.getByLabel('Address').fill('1 Lifecycle Street')
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/locations') &&
          response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: 'Add location' }).click()
      const created = (await (await createResponse).json()) as {
        location?: { id?: string }
      }
      locationId = created.location?.id
      expect(locationId).toBeTruthy()

      await expect(page.getByRole('status')).toContainText('Location added.')
      const location = page
        .locator('.location-list-item')
        .filter({ hasText: locationName })
      await expect(location).toBeVisible()
      await expect(location).toContainText('1 Lifecycle Street')

      await location.getByRole('button', { name: 'Edit location' }).click()
      await expect(
        page
          .locator('[data-slot="card-title"]')
          .filter({ hasText: 'Edit location' }),
      ).toBeVisible()
      await page.getByLabel('Location name').fill(renamedLocationName)
      await page.getByLabel('Address').fill('2 Lifecycle Street')
      await page.getByRole('button', { name: 'Save location' }).click()

      await expect(page.getByRole('status')).toContainText('Location updated.')
      const renamedLocation = page
        .locator('.location-list-item')
        .filter({ hasText: renamedLocationName })
      await expect(renamedLocation).toBeVisible()
      await expect(renamedLocation).toContainText('2 Lifecycle Street')

      await renamedLocation
        .getByRole('button', { name: 'Remove location' })
        .click()
      await expect(
        page.getByRole('heading', { name: `Remove ${renamedLocationName}?` }),
      ).toBeVisible()
      await expect(
        page.getByText('This deletes 0 imports and 0 imported rows.'),
      ).toBeVisible()

      await page.getByRole('button', { name: 'Remove location' }).last().click()

      await expect(page.getByRole('status')).toContainText('Location removed.')
      await expect(renamedLocation).toHaveCount(0)
    } finally {
      if (locationId) {
        const response = await page.request.delete(
          `/api/locations/${locationId}`,
        )
        expect([204, 404]).toContain(response.status())
      }
    }
  })
})

test('does not render a foreign account location dashboard', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /Sign out/ })).toBeVisible()

  await page.goto(`/dashboard?locationId=${foreignAccountLocationId}`)

  // The server rejects the foreign location before any dashboard component is
  // rendered. Keep the browser assertion focused on the trust boundary: the
  // framework's error response must not contain foreign figures.
  await expect(
    page.getByText(foreignAccountLocationName, { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'What is costing you money?' }),
  ).toHaveCount(0)
})
