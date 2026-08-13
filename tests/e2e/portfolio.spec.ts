import { expect, test } from '@playwright/test'

import {
  fullYearLocationFixture,
  partialDataLocationFixture,
} from '../fixtures/pantry'

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
    await expect(
      page.getByRole('heading', {
        name: 'Full-year data kitchen: ready for a closer look.',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Start with the data you already have.',
      }),
    ).toHaveCount(0)

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

  test('compacts downstream dashboard section headers without hiding qualifiers', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 812 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(
        `/dashboard?locationId=${fullYearLocationFixture.locationId}`,
      )

      await expect(
        page.locator('.wallet-impact__heading .app-page__eyebrow'),
      ).toHaveCount(1)
      await expect(
        page.locator(
          '.recommendation-list__heading .app-page__eyebrow, .trend-summary-grid__heading .app-page__eyebrow, .item-deep-dives__heading .app-page__eyebrow',
        ),
      ).toHaveCount(0)
      await expect(
        page.locator('.dashboard-section-heading--compact'),
      ).toHaveCount(3)
      await expect(page.locator('.app-page__qualifier')).toHaveCount(3)

      const measurements = await page.evaluate(() => ({
        pageHeight: document.documentElement.scrollHeight,
        qualifiers: Array.from(
          document.querySelectorAll('.app-page__qualifier'),
        ).map((element) => element.textContent?.trim()),
      }))
      if (viewport.width === 1280) {
        expect(measurements.pageHeight).toBeLessThan(2694)
      }
      expect(measurements.pageHeight).toBeGreaterThan(0)
      expect(
        await page.evaluate(() => document.body.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width)
      expect(measurements.qualifiers).toEqual([
        'Latest completed metric run; you decide what happens next.',
        'Weekly imported rows only; missing points mean the data could not support that calculation.',
        'Choose revenue, spoilage risk, or margin to see imported facts for an item.',
      ])
    }
  })

  test('shows dashboard item groups as patterned ranked rows', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 812 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(
        `/dashboard?locationId=${fullYearLocationFixture.locationId}`,
      )

      const rows = page.locator('.item-deep-dives__item')
      await expect(rows.first()).toBeVisible()
      await expect(
        rows.first().locator('.item-deep-dives__item-bar-fill'),
      ).toBeVisible()
      await expect(
        rows.first().locator('.item-deep-dives__item-state'),
      ).toBeVisible()
      await expect(
        rows.first().locator('.item-deep-dives__item-value'),
      ).toHaveText(/\S/)

      const rowData = await rows.evaluateAll((elements) =>
        elements.map((row) => ({
          text: row.textContent?.replace(/\s+/g, ' ').trim(),
          pattern:
            row.querySelector('.item-deep-dives__item-bar-fill')?.className ??
            '',
        })),
      )
      expect(rowData.every(({ text }) => Boolean(text))).toBe(true)
      expect(
        rowData.every(({ pattern }) =>
          /\bpat--(solid|hatch|cross|dots|vertical)\b/.test(pattern),
        ),
      ).toBe(true)

      const pageWidths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: window.innerWidth,
      }))
      expect(pageWidths.body).toBeLessThanOrEqual(pageWidths.viewport)
    }
  })

  test('collapses unavailable trend cards into a compact data requirement', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(
        `/dashboard?locationId=${partialDataLocationFixture.locationId}`,
      )

      const cards = page.locator('.trend-summary-grid__cards')
      await expect(cards).toBeVisible()
      await expect(
        page.getByText('Needs 4 weeks · has 2 · 2 more weeks needed', {
          exact: true,
        }),
      ).toHaveCount(3)
      const missingDetails = cards.locator(
        '.trend-summary-card__missing-detail',
      )
      await expect(missingDetails).toHaveCount(3)
      for (let index = 0; index < 3; index += 1) {
        await expect(missingDetails.nth(index)).toHaveText(
          /No comparison.*prior week unavailable/,
        )
        await expect(missingDetails.nth(index)).toHaveAttribute(
          'aria-label',
          /Not enough data.*No comparison.*previous week/,
        )
      }
      const box = await cards.boundingBox()
      expect(box?.height ?? Infinity).toBeLessThan(200)
      await expect(cards.locator('.chart-svg')).toHaveCount(0)
    }
  })
})
