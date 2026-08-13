import { expect, test as setup } from '@playwright/test'
import path from 'node:path'

const authFile = path.resolve('tests/.auth/owner.json')
const fallbackPassword = 'pantryiq-shared-owner-2026'

setup('authenticate the shared owner account', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (email && password) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /Sign in/ }).click()
  } else {
    const generatedEmail = `e2e-owner-${Date.now()}@example.test`
    await page.goto('/sign-up')
    await page.getByLabel('Name').fill('Shared E2E Owner')
    await page.getByLabel('Email').fill(generatedEmail)
    await page.getByLabel('Password').fill(fallbackPassword)
    await page.getByRole('button', { name: 'Create account' }).click()
  }

  if (!email || !password) {
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(
      page.getByRole('heading', { name: 'Start with one location.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Add location' }),
    ).toBeEnabled()
    await page.getByLabel('Location name').fill('E2E setup kitchen')
    await page.getByRole('button', { name: 'Add location' }).click()
    await expect(page).toHaveURL(/\/import\?locationId=/)

    // The setup location only unlocks the first-session route. Seed setup
    // creates the stable full-year and partial-history locations next.
    const setupLocationId = new URL(page.url()).searchParams.get('locationId')
    if (!setupLocationId) throw new Error('The setup location was not created.')
    const deletion = await page.request.delete(
      `/api/locations/${setupLocationId}`,
    )
    expect(deletion.status()).toBe(204)
    await page.goto('/account')
  }
  await expect(page).not.toHaveURL(/\/sign-in/)
  await page.context().storageState({ path: authFile })
})
