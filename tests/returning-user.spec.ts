import { expect, test } from '@playwright/test'

/**
 * The second end-to-end path, added by the 2026-08-10 testing audit.
 *
 * tests/critical-path.spec.ts covers a brand-new account: signup through first
 * import. This one covers the path an operator actually walks every day —
 * signing back in, moving between locations, and getting data back out — which
 * exercises session restore, the location switcher, and the export route
 * together. Keep end-to-end coverage to these two specs; they are slow.
 */

const password = 'pantryiq-returning-user-2026'

test('sign in, switch location, open chat, export CSV', async ({ page }) => {
  const email = `returning-user-${Date.now()}@example.test`

  // Arrange: an account with two locations, created through the real UI so the
  // test never depends on a fixture the product does not produce itself.
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Returning Operator')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/account$/)

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

  await expect(page).toHaveURL(/\/(dashboard|account)/)

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
