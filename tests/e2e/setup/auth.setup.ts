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

  await expect(page).toHaveURL(/\/account$/)
  await page.context().storageState({ path: authFile })
})
