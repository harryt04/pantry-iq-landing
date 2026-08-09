import { expect, test } from '@playwright/test'

const password = 'pantryiq-critical-path-2026'

test('signup, location, CSV import, and dashboard', async ({ page }) => {
  const email = `critical-path-${Date.now()}@example.test`

  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Critical Path Operator')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/account$/)
  await expect(
    page.getByRole('heading', { name: 'Manage your locations.' }),
  ).toBeVisible()

  await page.getByLabel('Location name').fill('Critical Path Kitchen')
  await page.getByLabel('Address').fill('100 Test Street')
  await page.getByRole('button', { name: 'Add location' }).click()
  await expect(page.getByRole('status')).toContainText('Location added.')

  await page.getByRole('link', { name: 'View dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard\?locationId=/)
  await expect(
    page.getByRole('heading', { name: 'Nothing to show yet.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Import a CSV' }).click()

  await expect(page).toHaveURL(/\/import\?locationId=/)
  await page.getByLabel('CSV file').setInputFiles({
    name: 'critical-path-sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Transaction ID,Item Name,Qty,Total Revenue\n2026-08-01T12:00:00Z,sale-1,Tomato Soup,2,17.00\n',
    ),
  })
  await page.getByRole('button', { name: 'Upload CSV' }).click()

  await expect(
    page.getByRole('heading', { name: 'One item needs your call.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Create and use this item' }).click()
  await expect(
    page.getByRole('heading', { name: /Ready to import 1 rows/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Import now' }).click()
  await expect(page.locator('.app-page__status')).toContainText(
    '1 rows imported.',
  )
  await page.getByRole('link', { name: 'Continue to dashboard' }).click()

  await expect(page).toHaveURL(/\/dashboard\?locationId=/)
  await expect(
    page.getByRole('heading', {
      name: 'Start with the data you already have.',
    }),
  ).toBeVisible()
  await expect(page.getByText('1 / 7 days')).toBeVisible()
})
