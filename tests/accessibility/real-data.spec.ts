import { createRequire } from 'node:module'

import { expect, test, type Page } from '@playwright/test'

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
