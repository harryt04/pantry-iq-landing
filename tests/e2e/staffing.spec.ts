import { expect, test } from '@playwright/test'

import {
  fullYearLocationFixture,
  partialDataLocationFixture,
} from '../fixtures/pantry'

test.describe('staffing analysis', () => {
  test('renders labor comparisons and a forecast for a full-year location', async ({
    page,
  }) => {
    await page.goto(
      `/staffing?locationId=${fullYearLocationFixture.locationId}`,
    )

    await expect(
      page.getByRole('heading', {
        name: 'See labor beside the sales it supported.',
      }),
    ).toBeVisible()
    await expect(page.getByText('By shift', { exact: true })).toBeVisible()
    await expect(page.getByText('By day part', { exact: true })).toBeVisible()
    await expect(
      page.getByText('By day of week', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('cell', { name: /Cook · \d{4}-\d{2}-\d{2}/ }).first(),
    ).toBeVisible()
    await expect(page.getByRole('cell', { name: /8 h/ }).first()).toBeVisible()

    await expect(
      page.getByText('Demand forecast', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(/prediction for the next seven business days/i),
    ).toBeVisible()
    await expect(page.getByText(/Forecast sales/i).first()).toBeVisible()
    await expect(
      page.getByText(
        /forecast calculations are available for the show-your-work record/i,
      ),
    ).toBeVisible()
  })

  test('names the missing history for a short-history location', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 812 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(
        `/staffing?locationId=${partialDataLocationFixture.locationId}`,
      )

      await expect(
        page.getByText('There is not a comparable period yet.', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByText('Demand forecast', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText(
          /14 of the required at least 28 distinct business days of transaction history/i,
        ),
      ).toBeVisible()
      await expect(
        page.getByText(/14 more business days needed\./),
      ).toBeVisible()
      await expect(page.getByText(/0 of the required/i)).toHaveCount(0)
      expect(
        await page.evaluate(() => document.body.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width)
    }
  })
})
