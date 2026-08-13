import path from 'node:path'

import { MOCK_UPLOAD_ID, expect, test } from './fixtures/mock-api'

import { fullYearLocationFixture } from '../fixtures/pantry'

test.describe('CSV import location state', () => {
  test('explains the missing location and links to location management', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.context().clearCookies({ name: 'pantryiq-location-id' })
    await page.goto('/import')

    await expect(
      page.getByRole('heading', {
        name: 'Choose a location before importing.',
      }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Imported rows belong to one location so the dashboard and audit trail stay clear.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Choose or add a location' }),
    ).toHaveAttribute('href', '/account')
    await expect(page.getByLabel('CSV file')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })
})

test.describe('CSV batch upload', () => {
  test('shows required columns, serves every sample, and imports each sample to confirmation', async ({
    page,
    mockApi,
  }) => {
    await mockApi()
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const samples = [
      {
        label: 'transactions',
        filename: 'pantryiq-transactions-sample.csv',
        header: 'Date,Item Name,Qty,Total Revenue',
      },
      {
        label: 'purchase orders',
        filename: 'pantryiq-purchase-orders-sample.csv',
        header: 'Order Date,Received Date,Supplier Name,Item,Qty,Unit Cost',
      },
      {
        label: 'inventory snapshots',
        filename: 'pantryiq-inventory-sample.csv',
        header: 'Count Date,Item,Qty,Unit',
      },
      {
        label: 'labor shifts',
        filename: 'pantryiq-labor-sample.csv',
        header:
          'Shift Start,Shift End,Employee Code,Role,Scheduled Hours,Actual Hours',
      },
    ]

    const sampleCards = page.locator('.csv-import-sample')
    await expect(sampleCards).toHaveCount(samples.length)

    for (const sample of samples) {
      const card = sampleCards.filter({ hasText: sample.label })
      const download = card.getByRole('link', {
        name: `Download ${sample.label} sample CSV`,
      })
      await expect(download).toHaveAttribute('download', sample.filename)

      const response = await page.request.get(
        `/import-samples/${sample.filename}`,
      )
      expect(response.status()).toBe(200)
      const contents = await response.text()
      expect(contents.split('\n')[0]).toBe(sample.header)

      await page.getByLabel('CSV file').setInputFiles({
        name: sample.filename,
        mimeType: 'text/csv',
        buffer: Buffer.from(contents),
      })
      await expect(
        page
          .locator('.csv-upload-job')
          .filter({ hasText: sample.filename })
          .locator('.csv-import-confirmation')
          .getByRole('heading', { name: /Ready to import/ }),
      ).toBeVisible()
    }
  })

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

  test('commits every ready file from one action and shows one combined summary', async ({
    page,
    mockApi,
  }) => {
    await mockApi()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const committedUploads: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.match(
          /^\/api\/uploads\/[^/]+\/commit$/,
        ) &&
        request.postDataJSON()?.dryRun !== true
      ) {
        committedUploads.push(request.url())
      }
    })

    await page.getByLabel('CSV file').setInputFiles([
      {
        name: 'sales.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
      },
      {
        name: 'labor.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
      },
    ])

    await expect(
      page.getByRole('button', { name: 'Import 2 ready files' }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByRole('button', { name: 'Import 2 ready files' })
          .evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Import 2 ready files' }).click()

    await expect.poll(() => committedUploads.length).toBe(2)
    await expect(
      page.getByRole('heading', { name: 'Batch import complete.' }),
    ).toBeVisible()
    await expect(page.getByText('2 rows imported')).toBeVisible()
    await expect(page.getByText('2 new items created')).toBeVisible()
    await expect(page.getByText('Files skipped: None')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(
      page.getByRole('heading', { name: 'Batch import complete.' }),
    ).toBeVisible()
  })

  test('explains a file skipped from the batch because it was already imported', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ alreadyImportedFilename: 'already.csv' })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const committedUploads: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname.match(
          /^\/api\/uploads\/[^/]+\/commit$/,
        ) &&
        request.postDataJSON()?.dryRun !== true
      ) {
        committedUploads.push(request.url())
      }
    })

    await page.getByLabel('CSV file').setInputFiles([
      {
        name: 'already.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
      },
      {
        name: 'new.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
      },
    ])

    await page.getByRole('button', { name: 'Import 2 ready files' }).click()

    await expect.poll(() => committedUploads.length).toBe(1)
    await expect(
      page.getByRole('heading', { name: 'Batch import complete.' }),
    ).toBeVisible()
    await expect(page.getByText('already.csv: Already imported')).toBeVisible()
  })

  test('keeps the five steps visible and puts other import tools behind a disclosure', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ mappingReview: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    const steps = page.getByRole('navigation', { name: 'Import steps' })
    await expect(steps).toContainText('Location')
    await expect(steps).toContainText('Upload file')
    await expect(steps).toContainText('Map columns')
    await expect(steps).toContainText('Match items')
    await expect(steps).toContainText('Confirm import')
    await expect(
      steps.locator('li').filter({ hasText: 'Upload file' }),
    ).toHaveAttribute('aria-current', 'step')

    const supportingTools = page.locator('details.import-supporting-tools')
    await expect(supportingTools).not.toHaveAttribute('open', '')
    await expect(
      page.getByRole('heading', { name: 'Record what happened today.' }),
    ).toBeHidden()

    await page.getByLabel('CSV file').setInputFiles({
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
    })
    await expect(
      steps.locator('li').filter({ hasText: 'Map columns' }),
    ).toHaveAttribute('aria-current', 'step')
    await expect(
      page.getByRole('heading', { name: 'A look at the first rows.' }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByLabel('Import type for sales.csv')
          .evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeGreaterThanOrEqual(44)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })

  test('resumes the active file, mapping, and item resolution after reload', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ uploadCommit: 'conflict' })
    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)

    await page.getByLabel('CSV file').setInputFiles({
      name: 'sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('date,item,quantity\n2026-08-01,salmon,2\n'),
    })
    await expect(
      page.getByRole('heading', { name: 'One item needs your call.' }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Unmatched item/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Ready to import 1 rows.' }),
    ).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'sales.csv' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Ready to import 1 rows.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'One item needs your call.' }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('navigation', { name: 'Import steps' })
        .locator('li[aria-current="step"]'),
    ).toContainText('Confirm import')
    await expect(page.locator('.csv-import-confirmation')).toContainText(
      '1 rows will link to existing items.',
    )
  })
})

test.describe('CSV upload failure paths', () => {
  test('keeps valid batch files running when a security-rejected file fails', async ({
    page,
    mockApi,
  }) => {
    await mockApi({
      uploadFailure: {
        filename: 'renamed-xlsx.csv',
        message: 'That file is not a CSV.',
      },
    })

    await page.goto(`/import?locationId=${fullYearLocationFixture.locationId}`)
    await page
      .getByLabel('CSV file')
      .setInputFiles([
        path.resolve(
          'tests/fixtures/csv/transactions/sales-one-year-daily.csv',
        ),
        path.resolve('tests/fixtures/csv/labor/7shifts-timesheet.csv'),
        path.resolve('tests/fixtures/csv/security/renamed-xlsx.csv'),
      ])

    const rejectedJob = page
      .locator('.csv-upload-job')
      .filter({ hasText: 'renamed-xlsx.csv' })
    await expect(rejectedJob.getByRole('alert')).toContainText(
      'That file is not a CSV.',
    )
    await expect(
      rejectedJob.getByRole('button', {
        name: 'Try again with renamed-xlsx.csv',
      }),
    ).toBeVisible()
    await expect(
      rejectedJob.getByRole('button', { name: 'Remove renamed-xlsx.csv' }),
    ).toBeVisible()
    await expect(
      page
        .locator('.csv-upload-job')
        .filter({ hasText: 'sales-one-year-daily.csv' }),
    ).toContainText('Ready to import 1 rows.')
    await page
      .locator('.csv-upload-job')
      .filter({ hasText: '7shifts-timesheet.csv' })
      .getByRole('button', { name: 'Work on 7shifts-timesheet.csv' })
      .click()
    await expect(
      page
        .locator('.csv-upload-job')
        .filter({ hasText: '7shifts-timesheet.csv' }),
    ).toContainText('Ready to import 1 rows.')

    await rejectedJob
      .getByRole('button', { name: 'Try again with renamed-xlsx.csv' })
      .click()
    await expect(rejectedJob).toContainText('A look at the first rows.')
  })

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
