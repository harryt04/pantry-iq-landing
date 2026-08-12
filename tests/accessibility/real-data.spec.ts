import { createRequire } from 'node:module'

import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')
const locationId = fullYearLocationFixture.locationId
const routes = [
  `/dashboard?locationId=${locationId}`,
  `/portfolio?locationId=${locationId}`,
  `/chat?locationId=${locationId}`,
  `/import?locationId=${locationId}`,
  `/usage?locationId=${locationId}`,
  `/staffing?locationId=${locationId}`,
  `/settings?locationId=${locationId}`,
  `/account`,
  `/recipes`,
  `/menu-engineering?locationId=${locationId}`,
]
const themes = ['light', 'dark'] as const

type AccessibilityResult = {
  violations: Array<{
    help: string
    id: string
    nodes: Array<{ html: string }>
  }>
}

async function loadAxe(page: Page) {
  await page.addScriptTag({ path: axePath })
}

type ChartContract = {
  bars: Array<{
    fill: string | null
    label: string | null
    value: string
  }>
  lines: Array<{
    dash: string | null
    label: string | null
    endLabel: string
  }>
}

async function assertGrayscaleReadable(page: Page, testInfo: TestInfo) {
  const headingBefore = await page.locator('h1').innerText()

  await page.addStyleTag({
    content: 'html { filter: grayscale(1) !important; }',
  })

  await expect
    .poll(() =>
      page
        .locator('html')
        .evaluate((element) => getComputedStyle(element).filter),
    )
    .toBe('grayscale(1)')

  expect(await page.locator('h1').innerText()).toBe(headingBefore)

  const contracts = await page
    .locator('svg.chart-svg')
    .evaluateAll((elements): ChartContract[] =>
      elements.map((element) => ({
        bars: [...element.querySelectorAll('rect.chart-mark')].map((mark) => ({
          fill: mark.getAttribute('fill'),
          label: mark.parentElement?.getAttribute('aria-label') ?? null,
          value:
            mark.parentElement?.querySelector('.chart-value')?.textContent ??
            '',
        })),
        lines: [...element.querySelectorAll('polyline.chart-line')].map(
          (line) => ({
            dash: line.getAttribute('stroke-dasharray'),
            label: line.parentElement?.getAttribute('aria-label') ?? null,
            endLabel:
              line.parentElement?.querySelector('.chart-line-label')
                ?.textContent ?? '',
          }),
        ),
      })),
    )

  for (const contract of contracts) {
    for (const bar of contract.bars) {
      expect(bar.fill).toMatch(/^url\(#/)
    }
    expect(contract.bars.every((bar) => bar.label && bar.value.trim())).toBe(
      true,
    )
    expect(
      contract.lines.every(
        (line) => line.dash && line.label && line.endLabel.trim(),
      ),
    ).toBe(true)
  }

  const screenshotPath = testInfo.outputPath('greyscale-real-data.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach('greyscale-real-data', {
    path: screenshotPath,
    contentType: 'image/png',
  })
}

for (const route of routes) {
  for (const colorScheme of themes) {
    test(`${route} passes axe with full-year data in ${colorScheme} theme`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: 900, width: 375 },
      })
      const page = await context.newPage()

      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      await loadAxe(page)

      const results = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                context?: unknown,
                options?: unknown,
              ) => Promise<AccessibilityResult>
            }
          }
        ).axe
        return axe.run(document, {
          rules: { 'target-size': { enabled: true } },
        })
      })

      expect(
        results.violations,
        JSON.stringify(results.violations, null, 2),
      ).toEqual([])
      await context.close()
    })
  }
}

for (const route of routes) {
  for (const colorScheme of themes) {
    test(`${route} remains readable in grayscale with full-year data in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: 900, width: 375 },
      })
      const page = await context.newPage()

      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      await assertGrayscaleReadable(page, testInfo)

      await context.close()
    })
  }
}
