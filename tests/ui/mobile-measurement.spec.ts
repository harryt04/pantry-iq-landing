import { expect, test, type Page } from '@playwright/test'

import { fullYearLocationFixture } from '../fixtures/pantry'

const locationId = fullYearLocationFixture.locationId

const routes = [
  { path: '/', heading: 'See what your kitchen data can tell you.' },
  { path: '/sign-in', heading: 'Sign in to PantryIQ' },
  {
    path: `/dashboard?locationId=${locationId}`,
    heading: 'Start with the data',
  },
  {
    path: `/chat?locationId=${locationId}`,
    heading: 'Ask about your operation.',
  },
  {
    path: `/import?locationId=${locationId}`,
    heading: "Bring in one location's data.",
  },
  {
    path: `/portfolio?locationId=${locationId}`,
    heading: 'See the whole business, then choose where to look.',
  },
  {
    path: `/usage?locationId=${locationId}`,
    heading: 'See what left the shelf.',
  },
  {
    path: `/staffing?locationId=${locationId}`,
    heading: 'See labor beside the sales it supported.',
  },
  { path: `/settings?locationId=${locationId}`, heading: 'Account settings.' },
  { path: '/account', heading: 'Manage your locations.' },
  {
    path: `/recipes?locationId=${locationId}`,
    heading: 'Build a recipe as you go.',
  },
  {
    path: `/menu-engineering?locationId=${locationId}`,
    heading: 'See what earns its place.',
  },
] as const

const spacingRoutes = ['/import', '/settings', '/recipes', '/account']
const spacingReadySelectors = [
  { prefix: '/import', selector: '.csv-upload-dropzone' },
  { prefix: '/settings', selector: '.settings-field' },
  { prefix: '/recipes', selector: '.recipe-field' },
  { prefix: '/account', selector: '.location-field' },
]

type Measurement = {
  selector: string
  value: string
}

type MobileReport = {
  route: string
  viewport: { width: number; height: number }
  pageScroll: {
    clientWidth: number
    documentScrollWidth: number
    bodyScrollWidth: number
    scrollXAfterProbe: number
  }
  pageOverflow: Measurement[]
  undersizedInteractive: Measurement[]
  undersizedControls: Measurement[]
  labelGaps: Measurement[]
  fieldGaps: Measurement[]
  nonPillRowActions: Measurement[]
}

function formatMeasurements(report: MobileReport) {
  const lines = [
    ...report.pageOverflow.map(
      (entry) => `page overflow ${entry.selector}: ${entry.value}`,
    ),
    ...report.undersizedInteractive.map(
      (entry) => `interactive ${entry.selector}: ${entry.value}`,
    ),
    ...report.undersizedControls.map(
      (entry) => `control ${entry.selector}: ${entry.value}`,
    ),
    ...report.labelGaps.map(
      (entry) => `label gap ${entry.selector}: ${entry.value}`,
    ),
    ...report.fieldGaps.map(
      (entry) => `field gap ${entry.selector}: ${entry.value}`,
    ),
    ...report.nonPillRowActions.map(
      (entry) => `row action ${entry.selector}: ${entry.value}`,
    ),
  ]

  return lines.join('\n')
}

function assertMobileReport(report: MobileReport) {
  expect(
    report.pageOverflow,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.undersizedInteractive,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.undersizedControls,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.labelGaps,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.fieldGaps,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.nonPillRowActions,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
}

function assertTappableReport(report: MobileReport) {
  expect(
    report.pageOverflow,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.undersizedInteractive,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.nonPillRowActions,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
}

function assertControlTypographyReport(report: MobileReport) {
  expect(
    report.undersizedControls,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
}

function assertFormSpacingReport(report: MobileReport) {
  expect(
    report.labelGaps,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
  expect(
    report.fieldGaps,
    `${report.route}\n${formatMeasurements(report)}`,
  ).toEqual([])
}

async function measurePage(page: Page, route: string): Promise<MobileReport> {
  return page.evaluate((currentRoute) => {
    const round = (value: number) => Math.round(value * 10) / 10
    const isVisible = (element: Element) => {
      const node = element as HTMLElement
      const styles = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return (
        node.getAttribute('aria-hidden') !== 'true' &&
        node.getAttribute('type') !== 'hidden' &&
        !node.classList.contains('sr-only') &&
        styles.display !== 'none' &&
        styles.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      )
    }
    const describe = (element: Element) => {
      const node = element as HTMLElement
      const id = node.id ? `#${node.id}` : ''
      const label =
        node.getAttribute('aria-label') ??
        node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ??
        ''
      const className =
        typeof node.className === 'string'
          ? node.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((name) => `.${name}`)
              .join('')
          : ''
      return `${node.tagName.toLowerCase()}${id}${className}${
        label ? ` [${label}]` : ''
      }`
    }
    const measurement = (element: Element, value: string): Measurement => ({
      selector: describe(element),
      value,
    })
    const controls = Array.from(
      document.querySelectorAll('input, select, textarea'),
    ).filter(isVisible)
    const interactive = Array.from(
      document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(isVisible)
    const labels = Array.from(document.querySelectorAll('label')).filter(
      isVisible,
    )
    const rowActions = Array.from(
      document.querySelectorAll(
        '.location-view-links a, .portfolio-table__link, .recipe-back-link, .menu-engineering-back-link, .usage-variance-back-link',
      ),
    ).filter(isVisible)

    const labelledControls = labels.flatMap((label) => {
      const htmlLabel = label as HTMLLabelElement
      const control = htmlLabel.control
      return control && isVisible(control) ? [{ label, control }] : []
    })

    const pageOverflow = Array.from(document.querySelectorAll('body *'))
      .filter(isVisible)
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
      .map((element) =>
        measurement(
          element,
          `right=${round(element.getBoundingClientRect().right)} viewport=${window.innerWidth}`,
        ),
      )

    const undersizedInteractive = interactive.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width >= 44 && rect.height >= 44
        ? []
        : [
            measurement(
              element,
              `${round(rect.width)}×${round(rect.height)} (minimum 44×44)`,
            ),
          ]
    })

    const undersizedControls = controls.flatMap((element) => {
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize)
      return fontSize >= 16
        ? []
        : [measurement(element, `${round(fontSize)}px (minimum 16px)`)]
    })

    const labelGaps = labelledControls.flatMap(({ label, control }) => {
      const labelStyles = getComputedStyle(label)
      const labelRect = label.getBoundingClientRect()
      const controlRect = control.getBoundingClientRect()
      const gap =
        label.contains(control) && labelStyles.display !== 'inline'
          ? Number.parseFloat(labelStyles.rowGap || labelStyles.gap || '0')
          : controlRect.top - labelRect.bottom
      return Math.abs(gap - 12) < 0.5
        ? []
        : [measurement(label, `${round(gap)}px (expected 12px)`)]
    })

    const fieldRoots = labelledControls.flatMap(({ label, control }) => {
      const root =
        label.closest('[class*="field"], [class*="form-row"], form > label') ??
        label
      return root.contains(control) || root.parentElement?.contains(control)
        ? [{ root, control }]
        : []
    })
    const fieldGaps = fieldRoots
      .sort(
        (left, right) =>
          left.root.getBoundingClientRect().top -
          right.root.getBoundingClientRect().top,
      )
      .flatMap((field, index, fields) => {
        const previous = fields[index - 1]
        if (!previous || previous.root === field.root) return []
        const previousRect = previous.root.getBoundingClientRect()
        const currentRect = field.root.getBoundingClientRect()
        const gap = currentRect.top - previousRect.bottom
        if (gap < 0 || gap > 80) return []
        return Math.abs(gap - 20) < 0.5
          ? []
          : [
              measurement(
                field.root,
                `${round(gap)}px (expected 20px from ${describe(previous.root)})`,
              ),
            ]
      })

    const nonPillRowActions = rowActions.flatMap((element) => {
      const styles = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const radius = Number.parseFloat(styles.borderTopLeftRadius)
      return radius >= rect.height / 2 && styles.display.includes('flex')
        ? []
        : [
            measurement(
              element,
              `${round(rect.width)}×${round(rect.height)}, radius=${styles.borderTopLeftRadius} (pill required)`,
            ),
          ]
    })

    const initialScrollX = window.scrollX
    window.scrollTo({ left: 2000, top: 0 })
    const scrollXAfterProbe = window.scrollX
    window.scrollTo({ left: initialScrollX, top: 0 })

    return {
      route: currentRoute,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScroll: {
        clientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        scrollXAfterProbe,
      },
      pageOverflow,
      undersizedInteractive,
      undersizedControls,
      labelGaps,
      fieldGaps,
      nonPillRowActions,
    }
  }, route)
}

test.describe('mobile measurement harness', () => {
  test('measures every operator route at 375px and prints actionable findings', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    for (const route of routes) {
      await test.step(route.path, async () => {
        await page.goto(route.path)
        await expect(page.locator('h1'), route.path).toContainText(
          route.heading,
        )
        const spacingReady = spacingReadySelectors.find(({ prefix }) =>
          route.path.startsWith(prefix),
        )
        if (spacingReady) {
          await expect(
            page.locator(spacingReady.selector).first(),
            route.path,
          ).toBeVisible()
        }
        if (route.path.startsWith('/import')) {
          const supportingTools = page.locator(
            'details.import-supporting-tools',
          )
          await supportingTools.locator('summary').click()
          await expect(
            page.getByRole('heading', { name: 'Record what happened today.' }),
            route.path,
          ).toBeVisible()
        }

        const report = await measurePage(page, route.path)
        console.log(
          `[mobile-measurement] ${route.path}\n${
            formatMeasurements(report) || 'no violations'
          }\nscroll=${JSON.stringify(report.pageScroll)}`,
        )

        expect(report.viewport).toEqual({ width: 375, height: 812 })
        assertTappableReport(report)
        assertControlTypographyReport(report)
        if (spacingRoutes.some((prefix) => route.path.startsWith(prefix))) {
          assertFormSpacingReport(report)
        }
      })
    }
  })

  test('fails with the selector and measured value for a seeded violation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.setContent(`
      <main>
        <form>
          <label for="seeded-control">Seeded control</label>
          <input id="seeded-control" style="font-size: 14px; height: 32px; width: 120px" />
        </form>
        <button id="seeded-button" style="height: 32px; width: 120px">Seeded button</button>
      </main>
    `)

    const report = await measurePage(page, '/seeded-violation')
    expect(formatMeasurements(report)).toContain(
      'interactive button#seeded-button [Seeded button]: 120×32 (minimum 44×44)',
    )
    expect(formatMeasurements(report)).toContain(
      'control input#seeded-control: 14px (minimum 16px)',
    )
    expect(() => assertMobileReport(report)).toThrow(
      /button#seeded-button.*minimum 44×44/s,
    )
  })
})
