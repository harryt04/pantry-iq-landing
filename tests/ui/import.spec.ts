import { expect, test } from './fixtures/mock-api'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('CSV upload failure paths', () => {
  test('surfaces a storage outage and leaves upload available to retry', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ uploads: 'unavailable' })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    await page.getByLabel('CSV file').setInputFiles({
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
    })
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(page.locator('p.app-page__error')).toContainText(
      'This service is temporarily unavailable.',
    )
    await expect(page.getByRole('button', { name: 'Upload CSV' })).toBeEnabled()
  })

  test('surfaces a 409 when the final commit still has unresolved items', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ uploadCommit: 'conflict' })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    await page.getByLabel('CSV file').setInputFiles({
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,quantity\n2026-08-01,unmatched item,2\n'),
    })
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(
      page.getByRole('heading', { name: 'One item needs your call.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: /Unmatched item/ }).click()

    await expect(
      page.getByRole('heading', { name: 'Ready to import 1 rows.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Import now' }).click()

    await expect(page.locator('p.app-page__error')).toContainText(
      'One or more item names are still unresolved.',
    )
    await expect(page.getByRole('button', { name: 'Import now' })).toBeEnabled()
  })
})

test.describe('CSV mapping review', () => {
  test('saves a changed mapping and reuses it for the next upload', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ mappingReview: true })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const csv = {
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,Quantity\n2026-08-01,salmon,2\n'),
    }

    await page.getByLabel('CSV file').setInputFiles(csv)
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(
      page.getByRole('heading', {
        name: "Let's place the uncertain columns.",
      }),
    ).toBeVisible()
    await page.locator('#mapping-field').selectOption('totalRevenue')
    await page.getByRole('button', { name: 'Review mapping' }).click()

    await expect(
      page.getByRole('heading', { name: 'Mapping reviewed.' }),
    ).toBeVisible()
    await expect(page.locator('p.app-page__status')).toContainText(
      'Mapping saved. Checking item names',
    )

    await page.getByLabel('CSV file').setInputFiles(csv)
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(
      page.getByRole('heading', { name: 'We reused your last mapping.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Change mapping' }).click()
    await page.getByRole('button', { name: 'Next column' }).click()
    await page.getByRole('button', { name: 'Next column' }).click()
    await expect(page.locator('#mapping-field')).toHaveValue('totalRevenue')
  })
})
