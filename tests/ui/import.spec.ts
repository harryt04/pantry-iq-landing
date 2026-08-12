import path from 'node:path'

import { MOCK_UPLOAD_ID, expect, test } from './fixtures/mock-api'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('CSV batch upload', () => {
  test('detects transaction and labor fixtures independently', async ({
    page,
    mockApi,
  }) => {
    await mockApi()
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const uploadedTypes: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/uploads'
      ) {
        uploadedTypes.push(request.headers()['x-pantryiq-import-type'] ?? '')
      }
    })

    await page
      .getByLabel('CSV file')
      .setInputFiles([
        path.resolve(
          'tests/fixtures/csv/transactions/sales-one-year-daily.csv',
        ),
        path.resolve('tests/fixtures/csv/labor/7shifts-timesheet.csv'),
      ])

    await expect(
      page.getByLabel('Import type for sales-one-year-daily.csv'),
    ).toHaveValue('transactions')
    await expect(
      page.getByLabel('Import type for 7shifts-timesheet.csv'),
    ).toHaveValue('labor')
    await expect.poll(() => uploadedTypes).toEqual(['transactions', 'labor'])
  })

  test('drops three CSVs, starts each upload immediately, and hides the native input', async ({
    page,
    mockApi,
  }) => {
    await mockApi()
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const uploadRequests: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/uploads'
      ) {
        uploadRequests.push(request.url())
      }
    })

    await page.evaluate(() => {
      const dataTransfer = new DataTransfer()
      for (const filename of ['sales.csv', 'labor.csv', 'inventory.csv']) {
        dataTransfer.items.add(
          new File(['date,item,quantity\n2026-08-01,salmon,2\n'], filename, {
            type: 'text/csv',
          }),
        )
      }
      document
        .querySelector<HTMLFormElement>(
          'form[aria-label="CSV upload drop zone"]',
        )
        ?.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          }),
        )
    })

    await expect(page.getByRole('heading', { name: 'sales.csv' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'labor.csv' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'inventory.csv' }),
    ).toBeVisible()
    await expect.poll(() => uploadRequests.length).toBe(3)
    await expect(page.locator('input[type="file"]')).toBeHidden()
    await expect(page.locator('.csv-upload-job')).toHaveCount(3)
  })
})

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

test.describe('CSV item resolution', () => {
  test('creates a new item and uses the category shelf-life suggestion', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ uploadCommit: 'conflict' })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    await page.getByLabel('CSV file').setInputFiles({
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,quantity\n2026-08-01,house sauce,2\n'),
    })
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(
      page.getByRole('heading', { name: 'One item needs your call.' }),
    ).toBeVisible()
    await page.getByLabel('Canonical name').fill('house sauce')
    await page.getByLabel('Display name').fill('House sauce')
    await page.getByLabel('Category (optional)').fill('Seafood')
    await expect(page.getByText('Suggested: 3 days.')).toBeVisible()

    const resolutionRequest = page.waitForRequest((request) => {
      if (
        request.method() !== 'POST' ||
        !request.url().endsWith(`/api/uploads/${MOCK_UPLOAD_ID}/commit`)
      )
        return false
      return (
        request.postData()?.includes('"canonicalName":"house sauce"') === true
      )
    })
    await page.getByRole('button', { name: 'Create and use this item' }).click()

    const request = await resolutionRequest
    const body = request.postDataJSON() as {
      resolutions: Record<string, unknown>
    }
    expect(body.resolutions).toEqual({
      'unmatched item': {
        canonicalName: 'house sauce',
        displayName: 'House sauce',
        category: 'Seafood',
        unit: 'each',
        shelfLifeDays: 3,
      },
    })
    await expect(
      page.getByRole('heading', { name: 'Ready to import 1 rows.' }),
    ).toBeVisible()
    await expect(page.getByText('1 new items will be created.')).toBeVisible()
  })

  test('keeps import blocked when an unresolved item is left without a choice', async ({
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
    await expect(
      page.getByRole('heading', { name: 'Ready to import 1 rows.' }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Import now' })).toHaveCount(
      0,
    )
  })
})
