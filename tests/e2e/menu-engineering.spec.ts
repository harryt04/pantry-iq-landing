import { expect, test } from '@playwright/test'

import {
  fullYearLocationFixture,
  partialDataLocationFixture,
} from '../fixtures/pantry'

test.describe('menu engineering', () => {
  test('renders the calculated popularity and margin matrix for full-year data', async ({
    page,
  }) => {
    await page.goto(
      `/menu-engineering?locationId=${fullYearLocationFixture.locationId}`,
    )

    await expect(
      page.getByRole('heading', { name: 'See what earns its place.' }),
    ).toBeVisible()
    await expect(
      page.getByText('Back to account', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('status').getByText(/1 item in the matrix/),
    ).toBeVisible()
    await expect(
      page.getByText(/business weeks observed/).first(),
    ).toBeVisible()
    await expect(
      page.getByText('Ranked menu items', { exact: true }),
    ).toBeVisible()

    const tomatoRow = page.getByRole('row').filter({ hasText: 'Tomato Soup' })
    await expect(tomatoRow).toBeVisible()
    await expect(
      tomatoRow.getByText('Star: popular and profitable', { exact: true }),
    ).toBeVisible()
    await expect(tomatoRow.getByText('122', { exact: true })).toBeVisible()
    await expect(tomatoRow.getByText('$9', { exact: true })).toBeVisible()
    await expect(tomatoRow.getByText('$1098', { exact: true })).toBeVisible()

    await expect(
      page.getByText('Items left out', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('House Salad', { exact: true }).last(),
    ).toBeVisible()
    await expect(
      page.getByText(
        'A complete recipe-derived plate margin is not available.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('img', { name: 'Menu engineering quadrant matrix' }),
    ).toBeVisible()
  })

  test('names the missing sales history for a short-history location', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 812 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(
        `/menu-engineering?locationId=${partialDataLocationFixture.locationId}`,
      )

      await expect(
        page.getByText('See what earns its place.', { exact: true }),
      ).toBeVisible()
      await expect(page.getByText(/0 items in the matrix/)).toBeVisible()
      await expect(
        page.getByText('Not enough comparable data yet', { exact: true }),
      ).toBeVisible()
      await expect(
        page
          .getByText(
            /Only \d+ complete business weeks? of sales; at least 4 are needed\./,
          )
          .first(),
      ).toBeVisible()
      await expect(
        page.getByRole('status').getByText(/\d+ more weeks? needed/),
      ).toBeVisible()
      await expect(
        page.getByText('Ranked menu items', { exact: true }),
      ).toHaveCount(0)
      expect(
        await page.evaluate(() => document.body.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width)
    }
  })
})
