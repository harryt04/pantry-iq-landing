import { expect, test } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('settings item master', () => {
  test('persists an item shelf-life assumption after reload', async ({
    page,
  }) => {
    await page.goto(
      `/settings?locationId=${fullYearLocationFixture.locationId}`,
    )

    const itemMaster = page.locator('#item-master')
    await expect(
      itemMaster.getByText('Menu items and ingredients', { exact: true }),
    ).toBeVisible()

    const itemRow = itemMaster
      .locator('tbody tr')
      .filter({ hasText: 'tomato soup' })
    await expect(itemRow).toBeVisible()
    await expect(itemRow).toContainText('No suggestion available')

    await itemRow.getByRole('button', { name: 'Edit' }).click()
    const shelfLife = page.getByLabel('Shelf life in days for Tomato Soup')
    await shelfLife.fill('7')
    await itemRow.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('status')).toContainText('Item saved.')
    await expect(itemRow).toContainText('7 days')
    await expect(itemRow).toContainText('Your value')

    await page.reload()

    const reloadedItemRow = page
      .locator('#item-master')
      .locator('tbody tr')
      .filter({ hasText: 'tomato soup' })
    await expect(reloadedItemRow).toContainText('7 days')
    await expect(reloadedItemRow).toContainText('Your value')
  })
})
