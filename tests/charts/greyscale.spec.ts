import { expect, test } from '@playwright/test'

test('gallery charts remain pattern-readable when desaturated', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/design/gallery')

  const charts = page.locator('svg.chart-svg')
  await expect(charts).toHaveCount(2)
  await page.addStyleTag({
    content: '.chart-svg { filter: grayscale(1); }',
  })

  const contracts = await charts.evaluateAll((elements) =>
    elements.map((element) => ({
      barFills: [...element.querySelectorAll('rect.chart-mark')].map((mark) =>
        mark.getAttribute('fill'),
      ),
      lineDashes: [...element.querySelectorAll('polyline.chart-line')].map(
        (line) => line.getAttribute('stroke-dasharray'),
      ),
      patternIds: [...element.querySelectorAll('pattern')].map(
        (pattern) => pattern.id,
      ),
    })),
  )

  expect(contracts[0]).toEqual({
    barFills: [
      'url(#bar-solid-0)',
      'url(#bar-solid-0)',
      'url(#bar-solid-0)',
      'url(#bar-solid-0)',
      'url(#bar-solid-0)',
    ],
    lineDashes: [],
    patternIds: ['bar-solid-0'],
  })
  expect(contracts[1]?.lineDashes).toEqual(['none', '8 6'])

  const screenshotPath = testInfo.outputPath('greyscale-charts.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach('greyscale-charts', {
    path: screenshotPath,
    contentType: 'image/png',
  })
})
