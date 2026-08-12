import { expect, test } from '@playwright/test'

test.describe('password recovery', () => {
  test.use({ storageState: undefined })

  test('submits forgot-password and reset-password forms', async ({ page }) => {
    const authRequests: string[] = []

    await page.route('**/api/auth/**', async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      authRequests.push(pathname)

      await route.fulfill({
        body: JSON.stringify({ status: true }),
        contentType: 'application/json',
        status: 200,
      })
    })

    await page.goto('/forgot-password')
    await expect(
      page.getByRole('heading', { name: 'Reset your password' }),
    ).toBeVisible()
    await page.getByLabel('Email').fill('operator@example.test')
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByRole('status')).toHaveText(
      'If an account uses that email, a reset link is on its way.',
    )
    await expect(page.getByText(/marketing|notification/i)).toHaveCount(0)

    await page.goto('/reset-password?token=mock-reset-token')
    await expect(
      page.getByRole('heading', { name: 'Choose a new password' }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: 'New password' })
      .fill('replacement-password-2026')
    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(page.getByRole('status')).toHaveText(
      'Your password was reset. You can sign in with the new password.',
    )
    expect(authRequests).toEqual([
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
    ])
  })
})
