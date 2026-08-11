import { expect, test } from '@playwright/test'

import {
  fullYearLocationFixture,
  partialDataLocationFixture,
} from '../fixtures/pantry'

test.describe('usage variance', () => {
  test('renders calculated usage and exclusions for a full-year location', async ({
    page,
  }) => {
    await page.goto(`/usage?locationId=${fullYearLocationFixture.locationId}`)

    await expect(
      page.getByRole('heading', { name: 'See what left the shelf.' }),
    ).toBeVisible()
    await expect(
      page.getByText('Theoretical versus actual', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Tomato', { exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByText('Possible explanations')).toBeVisible()
    await expect(
      page.getByText('Where the excess usage sits', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Items left out', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'No active recipe; its ingredients are excluded from variance.',
        { exact: true },
      ),
    ).toBeVisible()
  })

  test('names missing inventory counts for a short-history location', async ({
    page,
  }) => {
    await page.goto(
      `/usage?locationId=${partialDataLocationFixture.locationId}`,
    )

    await expect(
      page.getByText('Theoretical versus actual', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Tomato', { exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByText('Need two inventory counts in the selected period.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByText('—', { exact: true }).first()).toBeVisible()
  })
})
