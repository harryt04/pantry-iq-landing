import { expect, test } from '@playwright/test'

test.describe('authentication form failures', () => {
  test.use({ storageState: undefined })

  test('does not distinguish a wrong password from an unknown email', async ({
    page,
  }) => {
    await page.route('**/api/auth/sign-in/email', async (route) => {
      const body = route.request().postDataJSON() as { email?: string }
      const message =
        body.email === 'missing@example.test'
          ? 'User not found'
          : 'Invalid email or password'

      await route.fulfill({
        body: JSON.stringify({ message }),
        contentType: 'application/json',
        status: 401,
      })
    })

    const visibleErrors: string[] = []
    for (const [email, password] of [
      ['operator@example.test', 'wrong-password-2026'],
      ['missing@example.test', 'any-password-2026'],
    ] as Array<[string, string]>) {
      await page.goto('/sign-in')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Sign in' }).click()

      const alert = page.locator('p[role="alert"]')
      await expect(alert).toHaveText(
        'That did not work. Check the details and try again.',
      )
      visibleErrors.push(await alert.innerText())
      await expect(page).toHaveURL(/\/sign-in$/)
    }

    expect(visibleErrors).toEqual([
      'That did not work. Check the details and try again.',
      'That did not work. Check the details and try again.',
    ])
    await expect(
      page.getByText(/user not found|invalid email or password/i),
    ).toHaveCount(0)
  })

  test('does not disclose that a sign-up email is already registered', async ({
    page,
  }) => {
    await page.route('**/api/auth/sign-up/email', async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: 'User already exists' }),
        contentType: 'application/json',
        status: 409,
      })
    })

    await page.goto('/sign-up')
    await page.getByLabel('Name').fill('Existing Operator')
    await page.getByLabel('Email').fill('operator@example.test')
    await page.getByLabel('Password').fill('valid-password-2026')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.locator('p[role="alert"]')).toHaveText(
      'That did not work. Check the details and try again.',
    )
    await expect(page).toHaveURL(/\/sign-up$/)
    await expect(page.getByText(/already exists/i)).toHaveCount(0)
  })
})
