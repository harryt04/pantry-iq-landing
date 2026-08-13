import { expect, test } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('portfolio rollup', () => {
  test('rolls up both owned locations while preserving each location status', async ({
    page,
  }) => {
    await page.goto(
      `/portfolio?locationId=${fullYearLocationFixture.locationId}`,
    )

    await expect(
      page.getByRole('heading', {
        name: 'See the whole business, then choose where to look.',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Money at risk across your locations',
      }),
    ).toBeVisible()

    const summary = page.getByRole('region', {
      name: 'Money at risk across your locations',
    })
    await expect(summary.getByText(/^\$\d/)).toBeVisible()
    await expect(
      summary.getByText(/locations? does not have a calculable dollar total\./),
    ).toBeVisible()

    const table = page.getByRole('table', {
      name: 'Portfolio location summary',
    })
    const fullYearRow = table.getByRole('row', {
      name: /Full-year data kitchen/,
    })
    await expect(fullYearRow.getByText('Ready', { exact: true })).toBeVisible()
    await expect(fullYearRow.getByText(/\$\d/, { exact: true })).toBeVisible()
    await expect(
      fullYearRow.getByRole('link', { name: 'Open dashboard' }),
    ).toHaveAttribute('href', /locationId=10000000-0000-4000-8000-000000000002/)

    const partialRow = table.getByRole('row', {
      name: /Fourteen-day data kitchen/,
    })
    await expect(
      partialRow.getByText('Waiting for data', { exact: true }),
    ).toBeVisible()
    await expect(
      partialRow.getByText('Not available', { exact: true }),
    ).toBeVisible()
  })

  test('makes the populated wallet impact amount the dominant dashboard figure', async ({
    page,
  }) => {
    await page.goto(
      `/dashboard?locationId=${fullYearLocationFixture.locationId}`,
    )

    const wallet = page.getByRole('region', {
      name: 'What is costing you money?',
    })
    await expect(wallet.locator('.wallet-impact-card__lead')).toHaveText(
      /^\$\d/,
    )

    const sizes = await page.evaluate(() => {
      const figure = document.querySelector('.wallet-impact-card__lead')
      const pageHeading = document.querySelector('.app-page--dashboard > h1')
      const support = document.querySelector(
        '.wallet-impact-card__details .figure',
      )
      return {
        figure: figure ? getComputedStyle(figure).fontSize : null,
        pageHeading: pageHeading
          ? getComputedStyle(pageHeading).fontSize
          : null,
        support: support ? getComputedStyle(support).fontSize : null,
      }
    })

    expect(sizes).toEqual({
      figure: '44px',
      pageHeading: '28px',
      support: '22px',
    })
  })
})
