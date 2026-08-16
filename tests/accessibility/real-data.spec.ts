import { createRequire } from 'node:module'
import path from 'node:path'

import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.setTimeout(120_000)

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
const importBatchFixtures = [
  path.resolve(
    'tests/fixtures/csv/transactions/sales-with-refunds-negative.csv',
  ),
  path.resolve('tests/fixtures/csv/labor/7shifts-timesheet.csv'),
]
const mappingFixture = path.resolve(
  'tests/fixtures/csv/transactions/sales-ambiguous-headers.csv',
)
const resolutionFixture = path.resolve(
  'tests/fixtures/csv/inventory/inventory-new-items-only.csv',
)
const confirmationFixture = path.resolve(
  'tests/fixtures/csv/transactions/sales-with-refunds-negative.csv',
)
const rejectedFixture = path.resolve(
  'tests/fixtures/csv/security/renamed-xlsx.csv',
)
const parserErrorFixture = path.resolve(
  'tests/fixtures/csv/malformed/ragged-column-counts.csv',
)

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

async function openImportFlow(page: Page) {
  await page.getByRole('button', { name: 'Import data' }).click()
  await expect(page.locator('#csv-file')).toBeAttached()
}

const visibleInteractiveSelector =
  'a[href]:not([aria-label="Open Next.js Dev Tools"]), button:not([aria-label="Open Next.js Dev Tools"]), input, select, textarea, summary, [tabindex="0"]'

async function assertKeyboardFocus(page: Page, startWithFirstTarget = false) {
  const focusTargetDetails = await page
    .locator(visibleInteractiveSelector)
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element)
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.getClientRects().length > 0 &&
            !element.closest('details:not([open])') &&
            !element.matches(':disabled') &&
            (element as HTMLElement).tabIndex >= 0
          )
        })
        .map((element) => ({
          id: element.id,
          label: element.getAttribute('aria-label'),
          text: element.textContent?.trim().slice(0, 40),
          tag: element.tagName.toLowerCase(),
        })),
    )
  const expectedFocusTargets = await page
    .locator(visibleInteractiveSelector)
    .evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const style = getComputedStyle(element)
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.getClientRects().length > 0 &&
            !element.closest('details:not([open])') &&
            !element.matches(':disabled') &&
            (element as HTMLElement).tabIndex >= 0
          )
        }).length,
    )

  let focusedTargets = 0
  let tabPresses = 0
  if (startWithFirstTarget) {
    await page.locator(visibleInteractiveSelector).first().focus()
    const initialFocusRing = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return (
        (style.outlineStyle !== 'none' &&
          parseFloat(style.outlineWidth) >= 2 &&
          parseFloat(style.outlineOffset) >= 2) ||
        style.boxShadow !== 'none'
      )
    })
    expect(initialFocusRing).toBe(true)
    focusedTargets = 1
  }
  while (focusedTargets < expectedFocusTargets) {
    tabPresses += 1
    if (tabPresses > expectedFocusTargets + 3)
      throw new Error(
        `Keyboard focus did not reach every import control. Targets: ${JSON.stringify(focusTargetDetails)}`,
      )
    await page.keyboard.press('Tab')
    const focus = await page.evaluate((selector) => {
      const element = document.activeElement
      if (!element)
        return {
          matches: false,
          skip: false,
          active: null,
          boxShadow: 'none',
          outlineOffset: '0px',
          outlineStyle: 'none',
          outlineWidth: '0px',
        }
      if (element.tagName.toLowerCase() === 'nextjs-portal')
        return {
          matches: false,
          skip: true,
          active: 'nextjs-portal',
          boxShadow: 'none',
          outlineOffset: '0px',
          outlineStyle: 'none',
          outlineWidth: '0px',
        }
      if (!element.matches(selector))
        return {
          matches: false,
          skip: false,
          active: `${element.tagName.toLowerCase()}#${element.id}.${element.className}`,
          boxShadow: 'none',
          outlineOffset: '0px',
          outlineStyle: 'none',
          outlineWidth: '0px',
        }
      const style = getComputedStyle(element)
      return {
        matches: true,
        skip: false,
        active: `${element.tagName.toLowerCase()}#${element.id}.${element.className}`,
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      }
    }, visibleInteractiveSelector)

    if (focus.skip) continue
    expect(
      focus.matches,
      `Unexpected active element: ${focus.active}; targets: ${JSON.stringify(focusTargetDetails)}`,
    ).toBe(true)
    if (!focus.matches) continue

    focusedTargets += 1
    const hasVisibleRing =
      (focus.outlineStyle !== 'none' &&
        parseFloat(focus.outlineWidth) >= 2 &&
        parseFloat(focus.outlineOffset) >= 2) ||
      focus.boxShadow !== 'none'
    expect(hasVisibleRing).toBe(true)
  }

  expect(focusedTargets).toBe(expectedFocusTargets)
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

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 812, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/dashboard sufficient-data surface remains conformant at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/dashboard?locationId=${locationId}`)
        await expect(
          page.getByRole('heading', {
            name: 'Full-year data kitchen: ready for a closer look.',
          }),
        ).toBeVisible()
        await expect(
          page.getByText(
            'The latest completed metric run is ready to review. Start with what is costing you money, then decide what to do next.',
          ),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'What is costing you money?' }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'What needs attention first?' }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'What has changed lately?' }),
        ).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'Import more data' }),
        ).toBeVisible()

        const forbiddenCopy = await page.locator('main').innerText()
        expect(forbiddenCopy).not.toMatch(
          /\b(revolutionary|seamless|effortless|powerful|robust|unlock|leverage|supercharge|game-changing|best-in-class|cutting-edge|delight|magic|simply|just|obviously|AI-powered|intelligent|smart)\b/i,
        )

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

        const undersizedControls = await page
          .locator(visibleInteractiveSelector)
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const style = getComputedStyle(element)
                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0' &&
                  element.getClientRects().length > 0 &&
                  !element.closest('details:not([open])') &&
                  !element.matches(':disabled')
                )
              })
              .map((element) => {
                const rect = element.getBoundingClientRect()
                return {
                  height: Math.round(rect.height),
                  label:
                    element.getAttribute('aria-label') ??
                    element.textContent?.trim().slice(0, 60) ??
                    element.tagName.toLowerCase(),
                  tag: element.tagName.toLowerCase(),
                  width: Math.round(rect.width),
                }
              })
              .filter(({ height, width }) => height < 44 || width < 44),
          )
        expect(undersizedControls).toEqual([])

        await assertKeyboardFocus(page, true)
        await assertGrayscaleReadable(page, testInfo)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)
      } finally {
        await context.close()
      }
    })
  }
}

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 812, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/dashboard insufficient-data surface remains conformant at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(
          `/dashboard?locationId=10000000-0000-4000-8000-000000000001`,
        )
        await expect(
          page.getByRole('heading', {
            name: 'Fourteen-day data kitchen: ready for a closer look.',
          }),
        ).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'What is costing you money?' }),
        ).toBeVisible()
        await expect(
          page.getByText(
            'I can’t calculate wallet impact until a metric run finishes.',
          ),
        ).toHaveCount(2)
        await expect(page.getByText('Not computed yet.')).toBeVisible()
        await expect(
          page.getByRole('heading', { name: 'What has changed lately?' }),
        ).toBeVisible()
        await expect(
          page.getByText('Needs 4 weeks · has 2 · 2 more weeks needed', {
            exact: true,
          }),
        ).toHaveCount(3)
        await expect(
          page.locator('.trend-summary-card .chart-svg'),
        ).toHaveCount(0)

        const forbiddenCopy = await page.locator('main').innerText()
        expect(forbiddenCopy).not.toMatch(
          /\b(revolutionary|seamless|effortless|powerful|robust|unlock|leverage|supercharge|game-changing|best-in-class|cutting-edge|delight|magic|simply|just|obviously|AI-powered|intelligent|smart)\b/i,
        )

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

        const undersizedControls = await page
          .locator(visibleInteractiveSelector)
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const style = getComputedStyle(element)
                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0' &&
                  element.getClientRects().length > 0 &&
                  !element.closest('details:not([open])') &&
                  !element.matches(':disabled')
                )
              })
              .map((element) => {
                const rect = element.getBoundingClientRect()
                return {
                  height: Math.round(rect.height),
                  label:
                    element.getAttribute('aria-label') ??
                    element.textContent?.trim().slice(0, 60) ??
                    element.tagName.toLowerCase(),
                  tag: element.tagName.toLowerCase(),
                  width: Math.round(rect.width),
                }
              })
              .filter(({ height, width }) => height < 44 || width < 44),
          )
        expect(undersizedControls).toEqual([])

        await assertKeyboardFocus(page, true)
        await assertGrayscaleReadable(page, testInfo)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)
      } finally {
        await context.close()
      }
    })
  }
}

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 900, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/welcome first-run surface remains accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto('/welcome')
        await expect(
          page.getByRole('heading', { name: 'Start with one location.' }),
        ).toBeVisible()
        await expect(
          page.getByText(
            'Name the location whose data you want to understand first. You can add more locations later.',
          ),
        ).toBeVisible()
        await expect(page.getByLabel('Location name')).toBeVisible()
        await expect(page.getByLabel('Address')).toBeVisible()
        await expect(
          page.getByRole('button', { name: 'Add location' }),
        ).toBeVisible()

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

        const undersizedControls = await page
          .locator('button:not([aria-label="Open Next.js Dev Tools"]), input')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const style = getComputedStyle(element)
                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  element.getClientRects().length > 0
                )
              })
              .map((element) => {
                const box = element.getBoundingClientRect()
                return {
                  height: box.height,
                  label:
                    element.getAttribute('aria-label') ??
                    element.textContent?.trim() ??
                    element.getAttribute('placeholder'),
                  tag: element.tagName.toLowerCase(),
                  width: box.width,
                }
              })
              .filter(({ height, width }) => height < 44 || width < 44),
          )
        expect(undersizedControls).toEqual([])

        const undersizedFormText = await page
          .locator('input')
          .evaluateAll((elements) =>
            elements
              .map((element) => ({
                fontSize: parseFloat(getComputedStyle(element).fontSize),
                id: element.id,
              }))
              .filter(({ fontSize }) => fontSize < 16),
          )
        expect(undersizedFormText).toEqual([])

        await assertKeyboardFocus(page, true)
        await assertGrayscaleReadable(page, testInfo)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)
      } finally {
        await context.close()
      }
    })

    test(`/welcome first location creation remains accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()
      let createdLocationId: string | undefined

      try {
        await page.goto('/welcome')
        await expect(
          page.getByRole('heading', { name: 'Start with one location.' }),
        ).toBeVisible()

        const name = `Conformance ${viewport.label} ${colorScheme} ${Date.now()}`
        const nameInput = page.getByLabel('Location name')
        const addressInput = page.getByLabel('Address')
        const addLocation = page.getByRole('button', { name: 'Add location' })

        await expect(addLocation).toBeEnabled()
        await nameInput.fill(name)
        await addressInput.fill('1 Conformance Street')

        const formGeometry = await page
          .locator('.first-session-location-form')
          .evaluate((form) => {
            const fields = [...form.querySelectorAll('.location-field')]
            const fieldRects = fields.map((field) => {
              const label = field.querySelector('label')
              const input = field.querySelector('input')
              if (!label || !input)
                throw new Error('Location field is incomplete.')
              const labelRect = label.getBoundingClientRect()
              const inputRect = input.getBoundingClientRect()
              return {
                labelToControl: Math.round(inputRect.top - labelRect.bottom),
                bottom: inputRect.bottom,
                top: labelRect.top,
              }
            })
            return {
              fieldGap: Math.round(fieldRects[1]!.top - fieldRects[0]!.bottom),
              labelToControl: fieldRects.map((field) => field.labelToControl),
            }
          })
        expect(formGeometry.labelToControl).toEqual([12, 12])
        expect(formGeometry.fieldGap).toBe(20)

        const undersizedControls = await page
          .locator('button:not([aria-label="Open Next.js Dev Tools"]), input')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const style = getComputedStyle(element)
                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  element.getClientRects().length > 0
                )
              })
              .map((element) => {
                const box = element.getBoundingClientRect()
                return {
                  height: Math.round(box.height),
                  label:
                    element.getAttribute('aria-label') ??
                    element.textContent?.trim() ??
                    element.getAttribute('placeholder'),
                  tag: element.tagName.toLowerCase(),
                  width: Math.round(box.width),
                }
              })
              .filter(({ height, width }) => height < 44 || width < 44),
          )
        expect(undersizedControls).toEqual([])

        const undersizedFormText = await page
          .locator('input')
          .evaluateAll((elements) =>
            elements
              .map((element) => ({
                fontSize: parseFloat(getComputedStyle(element).fontSize),
                id: element.id,
              }))
              .filter(({ fontSize }) => fontSize < 16),
          )
        expect(undersizedFormText).toEqual([])

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

        await assertKeyboardFocus(page, true)
        await assertGrayscaleReadable(page, testInfo)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width)

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/locations') &&
            response.request().method() === 'POST',
        )
        await addLocation.click()
        const created = (await (await createResponse).json()) as {
          location?: { id?: string }
        }
        createdLocationId = created.location?.id
        expect(createdLocationId).toBeTruthy()
        await expect(page).toHaveURL(/\/import\?locationId=/)
        await expect(
          page.getByRole('combobox', { name: 'Selected location' }),
        ).toContainText(name)
      } finally {
        if (createdLocationId) {
          const response = await page.request.delete(
            `/api/locations/${createdLocationId}`,
          )
          expect([204, 404]).toContain(response.status())
        }
        await context.close()
      }
    })

    test(`/import file selection and batch list remain accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/import?locationId=${locationId}`)
        await expect(
          page.getByRole('heading', { name: "Bring in one location's data." }),
        ).toBeVisible()

        await openImportFlow(page)
        await page.route('**/api/uploads/*/commit', async (route) => {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              summary: {
                alreadyImported: false,
                filename: 'batch-preview.csv',
                importType: 'transactions',
                items: [],
                linkedItems: 1,
                newItems: 0,
                ready: true,
                rowsImported: 0,
                rowsToImport: 1,
                unmatchedItems: [],
              },
            }),
            status: 200,
          })
        })

        await page.locator('#csv-file').setInputFiles(importBatchFixtures)
        const importQueue = page.getByRole('navigation', {
          name: 'Files in this import',
        })
        await expect(importQueue.getByRole('button')).toHaveCount(2)
        for (const filename of [
          'sales-with-refunds-negative.csv',
          '7shifts-timesheet.csv',
        ]) {
          await importQueue
            .getByRole('button', { name: new RegExp(filename) })
            .click()
          const job = page.locator('.csv-upload-job')
          await expect(
            job.getByRole('heading', { name: filename }),
          ).toBeVisible({
            timeout: 120_000,
          })
          await expect(job.locator('.csv-preview')).toBeVisible({
            timeout: 120_000,
          })
          await expect(job.locator('[role="alert"]')).toHaveCount(0)
        }
        await expect(
          page.getByRole('heading', { name: '2 files are ready.' }),
        ).toBeVisible({ timeout: 120_000 })

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

        await assertKeyboardFocus(page)
        await assertGrayscaleReadable(page, testInfo)
      } finally {
        await context.close()
      }
    })
  }
}

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 900, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/import rejected-file and error states remain accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/import?locationId=${locationId}`)
        await expect(
          page.getByRole('heading', { name: "Bring in one location's data." }),
        ).toBeVisible()

        await openImportFlow(page)
        await page.locator('#csv-file').setInputFiles(rejectedFixture)
        const rejectedJob = page
          .locator('.csv-upload-job')
          .filter({ hasText: path.basename(rejectedFixture) })
        await expect(rejectedJob.getByRole('alert')).toContainText(
          'This file could not be processed.',
          { timeout: 120_000 },
        )
        await expect(
          rejectedJob.getByRole('button', {
            name: `Try again with ${path.basename(rejectedFixture)}`,
          }),
        ).toBeVisible()
        await expect(
          rejectedJob.getByRole('button', {
            name: `Remove ${path.basename(rejectedFixture)}`,
          }),
        ).toBeVisible()

        await page.locator('#csv-file').setInputFiles(parserErrorFixture)
        const parserErrorJob = page
          .locator('.csv-upload-job')
          .filter({ hasText: path.basename(parserErrorFixture) })
        await expect(parserErrorJob.locator('.csv-preview')).toBeVisible({
          timeout: 120_000,
        })
        await expect(parserErrorJob.locator('.app-page__error')).toContainText(
          'had a different number of columns than the header',
        )

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

        await assertKeyboardFocus(page)
        await assertGrayscaleReadable(page, testInfo)
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true)
      } finally {
        await context.close()
      }
    })

    test(`/import confirmation and result remain accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/import?locationId=${locationId}`)
        await expect(
          page.getByRole('heading', { name: "Bring in one location's data." }),
        ).toBeVisible()

        await openImportFlow(page)
        await page.route('**/api/uploads/*/commit', async (route) => {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              summary: {
                alreadyImported: false,
                filename: path.basename(confirmationFixture),
                importType: 'transactions',
                items: [],
                linkedItems: 1,
                newItems: 1,
                ready: true,
                rowsImported: 2,
                rowsToImport: 2,
                unmatchedItems: [],
              },
            }),
            status: 200,
          })
        })

        await page.locator('#csv-file').setInputFiles(confirmationFixture)
        const job = page
          .locator('.csv-upload-job')
          .filter({ hasText: path.basename(confirmationFixture) })
        await expect(
          job.getByRole('heading', { name: 'Ready to import 2 rows.' }),
        ).toBeVisible({ timeout: 120_000 })

        await loadAxe(page)
        const confirmationResults = await page.evaluate(async () => {
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
          confirmationResults.violations,
          JSON.stringify(confirmationResults.violations, null, 2),
        ).toEqual([])
        await assertKeyboardFocus(page)
        await assertGrayscaleReadable(page, testInfo)

        await job.getByRole('button', { name: 'Import now' }).click()
        await expect(
          job.getByRole('heading', { name: 'Imported 2 rows.' }),
        ).toBeVisible()
        await expect(
          job.getByText(
            '1 new items created. 1 rows linked to existing items.',
          ),
        ).toBeVisible()
        await expect(
          job.getByRole('link', { name: 'Continue to dashboard' }),
        ).toBeVisible()
        await expect(
          job.getByRole('heading', { name: 'Ready to import 2 rows.' }),
        ).toHaveCount(0)

        const resultResults = await page.evaluate(async () => {
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
          resultResults.violations,
          JSON.stringify(resultResults.violations, null, 2),
        ).toEqual([])
        const resultLink = job.getByRole('link', {
          name: 'Continue to dashboard',
        })
        await resultLink.focus()
        await expect
          .poll(() =>
            resultLink.evaluate((element) => {
              const style = getComputedStyle(element)
              return (
                (style.outlineStyle !== 'none' &&
                  parseFloat(style.outlineWidth) >= 2 &&
                  parseFloat(style.outlineOffset) >= 2) ||
                style.boxShadow !== 'none'
              )
            }),
          )
          .toBe(true)
        await assertGrayscaleReadable(page, testInfo)
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true)
      } finally {
        await context.close()
      }
    })
  }
}

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 900, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/import item resolution remains accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/import?locationId=${locationId}`)
        await openImportFlow(page)
        await page.locator('#csv-file').setInputFiles(resolutionFixture)

        const resolution = page.locator('.csv-item-resolution')
        await expect(resolution).toBeVisible({ timeout: 120_000 })
        await expect(
          resolution.getByRole('heading', {
            name: 'One item needs your call.',
          }),
        ).toBeVisible()
        await expect(
          resolution.getByRole('list', { name: 'Existing items' }),
        ).toBeVisible()
        await expect(resolution.getByLabel('Canonical name')).toBeVisible()
        await expect(
          resolution.getByRole('button', { name: 'Create and use this item' }),
        ).toBeVisible()
        if (viewport.width === 375) {
          const undersizedCandidates = await resolution
            .locator('.csv-item-resolution__candidate')
            .evaluateAll((elements) =>
              elements
                .map((element) => {
                  const rect = element.getBoundingClientRect()
                  return {
                    label: element.textContent?.trim(),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  }
                })
                .filter(({ width, height }) => width < 44 || height < 44),
            )
          expect(undersizedCandidates).toEqual([])
        }

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

        await assertKeyboardFocus(page)
        await assertGrayscaleReadable(page, testInfo)
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true)
      } finally {
        await context.close()
      }
    })
  }
}

for (const colorScheme of themes) {
  for (const viewport of [
    { label: 'mobile', height: 900, width: 375 },
    { label: 'desktop', height: 900, width: 1280 },
  ]) {
    test(`/import preview and column mapping remain accessible at ${viewport.label} in ${colorScheme} theme`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: viewport.height, width: viewport.width },
      })
      const page = await context.newPage()

      try {
        await page.goto(`/import?locationId=${locationId}`)
        await openImportFlow(page)
        await page.locator('#csv-file').setInputFiles(mappingFixture)

        await expect(page.locator('#csv-preview-title')).toBeVisible({
          timeout: 120_000,
        })
        const preview = page.getByRole('region', {
          name: `Preview of ${path.basename(mappingFixture)}`,
        })
        await expect(
          preview.locator('.csv-preview__table-wrap'),
        ).toHaveAttribute('tabindex', '0')
        await expect(
          page.locator('section.csv-mapping').filter({
            hasText: 'Column mapping',
          }),
        ).toContainText(
          /All columns matched|Let.s place the uncertain columns|reused your last mapping/,
        )

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

        await assertKeyboardFocus(page)
        await assertGrayscaleReadable(page, testInfo)
      } finally {
        await context.close()
      }
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
