import { expect, test } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

const locationId = fullYearLocationFixture.locationId
const screens = [
  { path: '/', heading: 'See what your kitchen data can tell you.' },
  { path: '/design/gallery', heading: 'Round controls. Square paper.' },
  { path: '/design/tokens', heading: 'Tokens, rendered' },
  { path: '/sign-in', heading: 'Sign in to PantryIQ' },
  { path: '/sign-up', heading: 'Start with one location' },
  { path: '/forgot-password', heading: 'Reset your password' },
  { path: '/reset-password', heading: 'Choose a new password' },
  {
    path: '/dashboard?locationId=' + locationId,
    heading: 'Full-year data kitchen: ready',
  },
  {
    path: '/chat?locationId=' + locationId,
    heading: 'Ask about your operation.',
  },
  {
    path: '/import?locationId=' + locationId,
    heading: "Bring in one location's data.",
  },
  {
    path: '/portfolio?locationId=' + locationId,
    heading: 'See the whole business, then choose where to look.',
  },
  {
    path: '/usage?locationId=' + locationId,
    heading: 'See what left the shelf.',
  },
  {
    path: '/staffing?locationId=' + locationId,
    heading: 'See labor beside the sales it supported.',
  },
  { path: '/settings?locationId=' + locationId, heading: 'Account settings.' },
  { path: '/account', heading: 'Manage your locations.' },
  {
    path: '/recipes?locationId=' + locationId,
    heading: 'Build a recipe as you go.',
  },
  {
    path: '/menu-engineering?locationId=' + locationId,
    heading: 'See what earns its place.',
  },
] as const

test('every screen renders at 375×812 in dark theme', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { height: 812, width: 375 },
  })
  await context.addInitScript(() => {
    window.localStorage.setItem('pantryiq-theme', 'dark')
  })

  try {
    const page = await context.newPage()

    for (const screen of screens) {
      await page.goto(screen.path)
      await expect(page.locator('h1'), screen.path).toContainText(
        screen.heading,
      )
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        height: window.innerHeight,
        width: window.innerWidth,
      }))
      const pageOverflow = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            if (rect.right <= window.innerWidth + 1) return false

            let ancestor = element.parentElement
            while (ancestor && ancestor !== document.body) {
              const overflowX = getComputedStyle(ancestor).overflowX
              if (['auto', 'clip', 'hidden', 'scroll'].includes(overflowX)) {
                return false
              }
              ancestor = ancestor.parentElement
            }
            return true
          })
          .map((element) => ({
            className: element.className,
            right: Math.round(element.getBoundingClientRect().right),
            tag: element.tagName,
          })),
      )
      expect(dimensions, screen.path).toEqual({
        clientWidth: 375,
        height: 812,
        width: 375,
      })
      expect(pageOverflow, screen.path).toEqual([])
    }
  } finally {
    await context.close()
  }
})
