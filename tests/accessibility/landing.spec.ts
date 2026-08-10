import { createRequire } from 'node:module'

import { expect, test, type Page } from '@playwright/test'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')
const routes = ['/', '/design/gallery', '/design/tokens']
const themes = ['light', 'dark'] as const
// Scrollable regions are tab-reachable so a keyboard user can pan a wide
// chart, so the focus-ring and touch-target gates have to cover them too.
const nonDevInteractiveSelector =
  'a:not([aria-label="Open Next.js Dev Tools"]), button:not([aria-label="Open Next.js Dev Tools"]), input, textarea, select, [role="button"]:not([aria-label="Open Next.js Dev Tools"]), [role="checkbox"], [role="radio"], [role="switch"], [role="region"][tabindex="0"]'

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
    test(`${route} passes axe in ${colorScheme} theme`, async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: 900, width: 375 },
      })
      const page = await context.newPage()

      await page.goto(route)
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
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      )
      await context.close()
    })
  }
}

test('the gate detects a deliberately broken interactive fixture', async ({
  page,
}) => {
  await page.setContent('<main><button></button></main>')
  await loadAxe(page)
  const results = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: () => Promise<AccessibilityResult> }
      }
    ).axe
    return axe.run()
  })

  expect(results.violations.some(({ id }) => id === 'button-name')).toBe(true)
})

test('interactive controls are keyboard reachable with the branded focus ring', async ({
  page,
}) => {
  await page.goto('/')
  const expectedFocusTargets = await page
    .locator(nonDevInteractiveSelector)
    .count()

  let focusedTargets = 0
  for (let index = 0; index < expectedFocusTargets + 1; index += 1) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate((selector) => {
      const element = document.activeElement
      if (!element || element === document.body || !element.matches(selector)) {
        return null
      }
      const style = getComputedStyle(element)
      return {
        isInteractive: true,
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    }, nonDevInteractiveSelector)

    if (!focus) break

    focusedTargets += 1
    expect(focus.isInteractive).toBe(true)
    expect(focus.outlineStyle).not.toBe('none')
    expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2)
    expect(parseFloat(focus.outlineOffset)).toBeGreaterThanOrEqual(2)
  }

  expect(focusedTargets).toBe(expectedFocusTargets)
})

for (const route of routes) {
  test(`${route} keeps visible touch targets at least 44px`, async ({
    page,
  }) => {
    await page.goto(route)
    const undersized = await page
      .locator(nonDevInteractiveSelector)
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element)
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              style.pointerEvents !== 'none' &&
              element.getBoundingClientRect().width >= 2 &&
              element.getBoundingClientRect().height >= 2
            )
          })
          .map((element) => {
            const box = element.getBoundingClientRect()
            return {
              height: box.height,
              label:
                element.getAttribute('aria-label') ??
                element.textContent?.trim(),
              width: box.width,
            }
          })
          .filter(({ height, width }) => height < 44 || width < 44),
      )

    expect(undersized).toEqual([])
  })
}

test('landing-page body copy stays at least 16px on mobile', async ({
  page,
}) => {
  await page.goto('/')
  const undersized = await page
    .locator('.landing-page p:not(.landing-eyebrow)')
    .evaluateAll((elements) =>
      elements
        .map((element) => ({
          fontSize: parseFloat(getComputedStyle(element).fontSize),
          text: element.textContent?.trim(),
        }))
        .filter(({ fontSize }) => fontSize < 16),
    )

  expect(undersized).toEqual([])
})

test('reduced motion disables transitions and animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const animated = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((element) => {
        const style = getComputedStyle(element)
        return {
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
        }
      })
      .filter(
        ({ animationDuration, transitionDuration }) =>
          animationDuration
            .split(',')
            .some((duration) => parseFloat(duration) > 0.01) ||
          transitionDuration
            .split(',')
            .some((duration) => parseFloat(duration) > 0.01),
      ),
  )

  expect(animated).toEqual([])
})
