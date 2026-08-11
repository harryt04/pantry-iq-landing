import { expect, test } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('recipes', () => {
  test('saves a recipe with an ingredient and reloads it from the database', async ({
    page,
  }) => {
    const recipeName = 'Browser test tomato soup'

    await page.goto(`/recipes?locationId=${fullYearLocationFixture.locationId}`)

    await expect(
      page.getByRole('heading', { name: 'Build a recipe as you go.' }),
    ).toBeVisible()
    await page.getByLabel('Recipe name').fill(recipeName)
    await page.getByLabel('Menu item').selectOption({ label: 'Tomato Soup' })
    await page.getByRole('button', { name: 'Add ingredient' }).click()
    await page.getByLabel('Quantity for Tomato').fill('2')

    await page.getByRole('button', { name: 'Save recipe' }).click()

    await expect(page.getByRole('status')).toContainText(
      'Recipe saved. You can keep building it when you have more to add.',
    )
    await expect(page.getByText(recipeName, { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText(recipeName, { exact: true })).toBeVisible()

    const savedRecipe = page
      .getByRole('listitem')
      .filter({ hasText: recipeName })
    await savedRecipe.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByLabel('Recipe name')).toHaveValue(recipeName)
    await expect(page.getByLabel('Menu item')).toHaveValue(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )
    await expect(page.getByLabel('Ingredient 1')).toHaveValue(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )
    await expect(
      page.getByLabel('Ingredient 1').locator('option:checked'),
    ).toHaveText('Tomato')
    await expect(page.getByLabel('Quantity for Tomato')).toHaveValue('2')
    await expect(page.getByLabel('Unit for Tomato')).toHaveValue('each')
  })
})
