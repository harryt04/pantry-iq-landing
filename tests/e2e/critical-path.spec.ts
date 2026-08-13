import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const transactionFixtures = [
  {
    filename: 'square-item-sales-clean.csv',
    rows: 10,
    columns: 6,
    delimiter: ',',
  },
  {
    filename: 'toast-menu-item-sales.csv',
    rows: 8,
    columns: 5,
    delimiter: ',',
  },
  {
    filename: 'clover-payments-export.csv',
    rows: 6,
    columns: 5,
    delimiter: ',',
  },
  {
    filename: 'lightspeed-sales-semicolon.csv',
    rows: 5,
    columns: 5,
    delimiter: ';',
  },
  {
    filename: 'revel-sales-tab-delimited.csv',
    rows: 5,
    columns: 4,
    delimiter: 'tab',
  },
] as const

const transactionBatchTwoFixtures = [
  {
    filename: 'square-latin1-accents.csv',
    rows: 4,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'latin-1',
    outcome: 'success',
  },
  {
    filename: 'square-utf8-bom.csv',
    rows: 3,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'toast-with-preamble-rows.csv',
    rows: 5,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'pos-headerless-sales.csv',
    rows: 5,
    columns: ['Column 1', 'Column 2', 'Column 3', 'Column 4'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'error',
    error: 'item name is required',
  },
  {
    filename: 'sales-duplicate-headers.csv',
    rows: 4,
    columns: ['Date', 'Item', 'Qty', 'Total', 'Total (2)'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
] as const

const transactionBatchThreeFixtures = [
  {
    filename: 'sales-ambiguous-headers.csv',
    rows: 5,
    columns: ['Date', 'Type', 'Description', 'Amount'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'error',
    error: 'quantity is required',
    itemResolution: false,
  },
  {
    filename: 'sales-modifiers-and-customizations.csv',
    rows: 5,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'sales-with-refunds-negative.csv',
    rows: 5,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'sales-messy-dates-mixed.csv',
    rows: 5,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'error',
    error: 'transaction date is required',
    itemResolution: false,
  },
  {
    filename: 'sales-one-year-daily.csv',
    rows: 1_825,
    columns: ['Date', 'Item Name', 'Qty', 'Unit Price', 'Total Revenue'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
] as const

const purchaseOrderBatchOneFixtures = [
  {
    filename: 'sysco-invoice-export.csv',
    rows: 4,
    columns: [
      'Order Date',
      'Supplier',
      'PO Number',
      'Item',
      'Qty',
      'Unit Cost',
      'Total Cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
  },
  {
    filename: 'usfoods-order-guide.csv',
    rows: 3,
    columns: [
      'Vendor',
      'Order Date',
      'PO #',
      'Item Description',
      'Quantity Ordered',
      'Ext Cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
  },
  {
    filename: 'marketman-purchases.csv',
    rows: 3,
    columns: [
      'Order date',
      'Received date',
      'Supplier name',
      'Item',
      'Qty',
      'Unit cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
  },
  {
    filename: 'po-multiline-single-order.csv',
    rows: 12,
    columns: ['Order Date', 'PO Number', 'Item', 'Qty', 'Unit Cost'],
    delimiter: ',',
    encoding: 'utf-8',
  },
  {
    filename: 'po-missing-external-id.csv',
    rows: 3,
    columns: ['Order Date', 'Supplier', 'Item', 'Qty', 'Unit Cost'],
    delimiter: ',',
    encoding: 'utf-8',
  },
] as const

const purchaseOrderBatchTwoFixtures = [
  {
    filename: 'po-received-before-ordered.csv',
    rows: 2,
    columns: [
      'Order Date',
      'Received Date',
      'Supplier',
      'Item',
      'Qty',
      'Unit Cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'po-unit-cost-times-qty-mismatch.csv',
    rows: 2,
    columns: [
      'Order Date',
      'Supplier',
      'Item',
      'Qty',
      'Unit Cost',
      'Total Cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
  {
    filename: 'po-currency-symbols-mixed.csv',
    rows: 5,
    columns: ['Order Date', 'Supplier', 'Item', 'Qty', 'Unit Cost'],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'error',
    error: /currency code|percentage/,
  },
  {
    filename: 'po-blank-received-dates.csv',
    rows: 3,
    columns: [
      'Order Date',
      'Received Date',
      'Supplier',
      'Item',
      'Qty',
      'Unit Cost',
    ],
    delimiter: ',',
    encoding: 'utf-8',
    outcome: 'success',
  },
] as const

const inventoryBatchFixtures = [
  {
    filename: 'manual-count-sheet.csv',
    rows: 4,
    columns: ['Count Date', 'Item', 'Qty', 'Unit', 'Category'],
    outcome: 'success',
  },
  {
    filename: 'inventory-with-units-and-shelf-life.csv',
    rows: 4,
    columns: ['Count Date', 'Item', 'Qty', 'Unit', 'Shelf Life Days'],
    outcome: 'success',
  },
  {
    filename: 'inventory-fractional-quantities.csv',
    rows: 4,
    columns: ['Count Date', 'Item', 'Qty', 'Unit'],
    outcome: 'success',
  },
  {
    filename: 'inventory-zero-and-blank-qty.csv',
    rows: 3,
    columns: ['Count Date', 'Item', 'Qty', 'Unit'],
    outcome: 'error',
    error: 'quantity is required',
  },
  {
    filename: 'inventory-new-items-only.csv',
    rows: 3,
    columns: ['Count Date', 'Item', 'Qty', 'Unit'],
    outcome: 'success',
    unmatchedItems: 3,
  },
  {
    filename: 'inventory-mixed-case-whitespace-names.csv',
    rows: 3,
    columns: ['Count Date', 'Item', 'Qty', 'Unit'],
    outcome: 'success',
  },
  {
    filename: 'inventory-two-counts-same-day.csv',
    rows: 3,
    columns: ['Count Date', 'Item', 'Qty', 'Unit'],
    outcome: 'success',
  },
] as const

const laborBatchFixtures = [
  {
    filename: '7shifts-timesheet.csv',
    rows: 3,
    columns: [
      'Shift Start',
      'Shift End',
      'Employee Code',
      'Role',
      'Scheduled Hours',
      'Actual Hours',
    ],
    outcome: 'success',
  },
  {
    filename: 'homebase-timesheet.csv',
    rows: 3,
    columns: [
      'Clock In',
      'Clock Out',
      'Staff ID',
      'Job Title',
      'Hours Worked',
      'Wage Cost',
    ],
    outcome: 'success',
  },
  {
    filename: 'labor-scheduled-only.csv',
    rows: 3,
    columns: ['Shift Start', 'Shift End', 'Role', 'Scheduled Hours'],
    outcome: 'success',
  },
  {
    filename: 'labor-actual-only.csv',
    rows: 2,
    columns: ['Shift Start', 'Shift End', 'Role', 'Actual Hours'],
    outcome: 'success',
  },
  {
    filename: 'labor-missing-both-hours.csv',
    rows: 2,
    columns: ['Shift Start', 'Shift End', 'Role'],
    outcome: 'error',
    error: 'map scheduled hours or actual hours',
  },
  {
    filename: 'labor-open-shift-no-end.csv',
    rows: 2,
    columns: ['Shift Start', 'Shift End', 'Role', 'Scheduled Hours'],
    outcome: 'success',
  },
] as const

const malformedBatchFixtures = [
  {
    filename: 'ragged-column-counts.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue', 'Column 5'],
    rows: 4,
    outcome: 'error',
    error: 'different number of columns than the header',
    importError: 'map total revenue or unit price',
  },
  {
    filename: 'quotes-unterminated.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 1,
    outcome: 'error',
    error: "had a quote I couldn't read",
    importError: 'The import could not be completed. Nothing was changed.',
  },
  {
    filename: 'quotes-embedded-newlines.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 2,
    outcome: 'success',
    importedRows: 2,
    unresolvedItems: 1,
  },
  {
    filename: 'quotes-escaped-doubled.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 2,
    outcome: 'success',
    importedRows: 2,
    unresolvedItems: 1,
  },
  {
    filename: 'blank-lines-and-trailing-whitespace.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 2,
    outcome: 'success',
    importedRows: 2,
  },
  {
    filename: 'header-only-no-rows.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 0,
    outcome: 'success',
    importedRows: 0,
  },
  {
    filename: 'single-column-no-delimiter.csv',
    columns: ['Column 1'],
    rows: 1,
    outcome: 'rejected',
    error: 'This file could not be processed.',
  },
  {
    filename: 'trailing-totals-row.csv',
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    rows: 4,
    outcome: 'error',
    error: "had a date I couldn't read",
    importError: 'item name is required',
  },
] as const

const securityBatchFixtures = [
  {
    filename: 'renamed-xlsx.csv',
    outcome: 'rejected',
    error: 'This file could not be processed.',
  },
  {
    filename: 'renamed-pdf.csv',
    outcome: 'rejected',
    error: 'This file could not be processed.',
  },
  {
    filename: 'contains-null-bytes.csv',
    outcome: 'rejected',
    error: 'This file could not be processed.',
  },
  {
    filename: 'formula-injection.csv',
    outcome: 'success',
    rows: 5,
    columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
    unresolvedItems: 4,
    importedRows: 5,
  },
  {
    filename: 'empty-file.csv',
    outcome: 'rejected',
    error: 'This file could not be processed.',
  },
] as const

async function assertAuthenticated(page: Page) {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/account$/)
}

async function createTestLocation(page: Page) {
  const response = await page.request.post('/api/locations', {
    data: {
      name: `Transaction batch ${Date.now()}`,
      address: '100 Test Street',
    },
  })
  expect(response.status()).toBe(201)
  const body = (await response.json()) as { location?: { id: string } }
  expect(body.location?.id).toBeTruthy()
  return body.location!.id
}

async function seedInventoryItems(
  page: Page,
  locationId: string,
  displayNames = [
    'Salmon Fillet',
    'House Salad',
    'Tomato Soup',
    'Bubble Tea',
    'Burger',
  ],
) {
  for (const displayName of displayNames) {
    const response = await page.request.post(
      `/api/manual-entry?locationId=${locationId}`,
      {
        data: {
          entryType: 'inventory',
          countedAt: '2025-01-01T00:00:00.000Z',
          item: {
            newItem: {
              canonicalName: displayName,
              displayName,
              category: null,
              unit: 'each',
            },
          },
          quantity: '0',
        },
      },
    )
    expect(response.status()).toBe(201)
  }
}

async function seedPurchaseOrderItems(page: Page, locationId: string) {
  for (const displayName of [
    'Salmon Fillet',
    'Romaine Lettuce',
    'Tomato',
    'Chicken Breast',
    'Butter',
    'Onion',
    'Garlic',
  ]) {
    const response = await page.request.post(
      `/api/manual-entry?locationId=${locationId}`,
      {
        data: {
          entryType: 'inventory',
          countedAt: '2025-01-01T00:00:00.000Z',
          item: {
            newItem: {
              canonicalName: displayName,
              displayName,
              category: null,
              unit: 'each',
            },
          },
          quantity: '0',
        },
      },
    )
    expect(response.status()).toBe(201)
  }
}

async function seedInventoryImportItems(page: Page, locationId: string) {
  for (const displayName of [
    'Salmon Fillet',
    'Romaine Lettuce',
    'Butter',
    'Tomato',
    'Heavy Cream',
    'Tomato Soup',
  ]) {
    const response = await page.request.post(
      `/api/manual-entry?locationId=${locationId}`,
      {
        data: {
          entryType: 'inventory',
          countedAt: '2025-01-01T00:00:00.000Z',
          item: {
            newItem: {
              canonicalName: displayName,
              displayName,
              category: null,
              unit: 'each',
            },
          },
          quantity: '0',
        },
      },
    )
    expect(response.status()).toBe(201)
  }
}

async function reviewMapping(page: Page) {
  const question = page.locator('.csv-mapping__question')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!(await question.isVisible())) return

    const source = (await question.locator('h3').textContent())?.trim()
    const field = question.locator('#mapping-field')
    if (source === 'Gross Sales') await field.selectOption('')

    const next = question.getByRole('button', {
      name: /Next column|Review mapping/,
    })
    const isLastColumn = await next.getByText('Review mapping').count()
    if (isLastColumn > 0) {
      const mappingResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/mapping') &&
          response.request().method() === 'PATCH',
      )
      await next.click()
      await mappingResponse
      return
    }
    await next.click()
  }
  throw new Error('CSV mapping did not finish within the expected columns.')
}

async function resolveNewItems(page: Page) {
  await expect(
    page.locator('.csv-item-resolution, .csv-import-confirmation'),
  ).toBeVisible()
  const resolution = page.locator('.csv-item-resolution')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!(await resolution.isVisible())) return
    const commitResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/commit') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Create and use this item' }).click()
    await commitResponse
  }
  throw new Error(
    'CSV item resolution did not finish within the expected items.',
  )
}

test('location, CSV import, and dashboard', async ({ page }) => {
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    await page.goto(`/dashboard?locationId=${locationId}`)
    await expect(
      page.getByRole('heading', { name: 'Nothing to show yet.' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Import a CSV' }).click()

    await expect(page).toHaveURL(/\/import\?locationId=/)
    await page.getByLabel('CSV file').setInputFiles({
      name: 'critical-path-sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Date,Transaction ID,Item Name,Qty,Total Revenue\n2026-08-01T12:00:00Z,sale-1,Tomato Soup,2,17.00\n',
      ),
    })
    await page.getByRole('button', { name: 'Upload CSV' }).click()

    await expect(
      page.getByRole('heading', { name: 'One item needs your call.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Create and use this item' }).click()
    await expect(
      page.getByRole('heading', { name: /Ready to import 1 rows/ }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Import now' }).click()
    await expect(page.locator('.app-page__status')).toContainText(
      '1 rows imported.',
    )
    await page.getByRole('link', { name: 'Continue to dashboard' }).click()

    await expect(page).toHaveURL(/\/dashboard\?locationId=/)
    await expect(
      page.getByRole('heading', {
        name: /: more history needed\./,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Start with the data you already have.',
      }),
    ).toHaveCount(0)
    await expect(page.getByText('1 / 7 days')).toBeVisible()
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test.describe('first-session value path', () => {
  test.use({ storageState: undefined })

  test('signs up, imports a full year, and reaches the first insight', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    const email = `first-insight-${Date.now()}@example.test`
    const password = 'pantryiq-first-insight-2026'
    const locationName = 'First insight kitchen'
    let locationId: string | null = null

    try {
      await page.goto('/sign-up')
      await page.getByLabel('Name').fill('First insight operator')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Create account' }).click()

      await expect(page).toHaveURL(/\/welcome$/)
      const firstLocationAction = page.getByRole('button', {
        name: 'Add location',
      })
      await expect(
        page.getByRole('heading', { name: 'Start with one location.' }),
      ).toBeVisible()
      await expect(firstLocationAction).toBeEnabled()
      await page.getByLabel('Location name').fill(locationName)
      await page.getByLabel('Address').fill('100 First Insight Street')
      const locationResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/locations') &&
          response.request().method() === 'POST',
      )
      await firstLocationAction.click()
      expect((await locationResponse).status()).toBe(201)

      await expect(page).toHaveURL(/\/import\?locationId=/)
      locationId = new URL(page.url()).searchParams.get('locationId')
      expect(locationId).toBeTruthy()
      await expect(
        page.getByRole('combobox', { name: 'Selected location' }),
      ).toContainText(locationName)

      await page
        .locator('#csv-file')
        .setInputFiles(
          path.resolve(
            'tests/fixtures/csv/transactions/sales-one-year-daily.csv',
          ),
        )
      await expect(page.locator('#csv-preview-title')).toBeVisible({
        timeout: 120_000,
      })
      await expect(page.locator('.csv-preview .app-page__help')).toContainText(
        '1,825 rows',
      )

      await reviewMapping(page)
      await resolveNewItems(page)
      await expect(
        page
          .locator('.csv-import-confirmation')
          .getByRole('heading', { name: 'Ready to import 1,825 rows.' }),
      ).toBeVisible()

      await page.getByRole('button', { name: 'Import now' }).click()
      await expect(page.locator('.app-page__status')).toContainText(
        '1,825 rows imported.',
        { timeout: 120_000 },
      )
      await page.getByRole('link', { name: 'Continue to dashboard' }).click()

      await expect(page).toHaveURL(/\/dashboard\?locationId=/)
      await expect(
        page.getByRole('heading', {
          name: `${locationName}: ready for a closer look.`,
        }),
      ).toBeVisible()

      const itemDeepDives = page.getByRole('region', {
        name: 'Look closer at an item.',
      })
      await expect(itemDeepDives).toContainText('Top selling')
      await expect(itemDeepDives).toContainText('Salmon Fillet')
      await expect(itemDeepDives).toContainText(/\$[\d,]+/)

      await page.setViewportSize({ width: 375, height: 812 })
      await page.reload()
      await expect(
        page.getByRole('heading', {
          name: `${locationName}: ready for a closer look.`,
        }),
      ).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(375)
    } finally {
      if (locationId) {
        const response = await page.request.delete(
          `/api/locations/${locationId}`,
        )
        expect([204, 404]).toContain(response.status())
      }
    }
  })
})

test('imports a public CSV sample through the real importer', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    await seedInventoryItems(page, locationId, ['Tomato Soup', 'House Salad'])
    const sample = await page.request.get(
      '/import-samples/pantryiq-transactions-sample.csv',
    )
    expect(sample.status()).toBe(200)

    await page.goto(`/import?locationId=${locationId}`)
    await page.locator('#csv-file').setInputFiles({
      name: 'pantryiq-transactions-sample.csv',
      mimeType: 'text/csv',
      buffer: await sample.body(),
    })
    await expect(page.locator('#csv-preview-title')).toBeVisible()
    await reviewMapping(page)
    await resolveNewItems(page)
    await expect(
      page
        .locator('.csv-import-confirmation')
        .getByRole('heading', { name: /Ready to import/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Import now' }).click()
    await expect(page.locator('.app-page__status')).toContainText(
      '2 rows imported.',
    )
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test('imports the first transaction corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    for (const fixture of transactionFixtures) {
      await test.step(`imports ${fixture.filename}`, async () => {
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('transactions')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/transactions', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows} rows · ${fixture.columns} columns · ${fixture.delimiter} delimited`,
        )

        await reviewMapping(page)
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows} rows imported.`,
        )
      })
    }
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test('imports the second transaction corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    for (const fixture of transactionBatchTwoFixtures) {
      await test.step(`imports ${fixture.filename}`, async () => {
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('transactions')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/transactions', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows.toLocaleString()} rows · ${fixture.columns.length} columns · ${fixture.delimiter} delimited · ${fixture.encoding}`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )
        if (fixture.outcome === 'error') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          return
        }
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows} rows imported.`,
        )
      })
    }
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test('imports the third transaction corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)

  for (const fixture of transactionBatchThreeFixtures) {
    const locationId = await createTestLocation(page)
    try {
      await test.step(`imports ${fixture.filename}`, async () => {
        if (
          fixture.filename === 'sales-ambiguous-headers.csv' ||
          fixture.filename === 'sales-messy-dates-mixed.csv' ||
          fixture.filename === 'sales-one-year-daily.csv'
        )
          await seedInventoryItems(page, locationId)
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('transactions')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/transactions', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows.toLocaleString()} rows · ${fixture.columns.length} columns · ${fixture.delimiter} delimited · ${fixture.encoding}`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )

        if (fixture.outcome === 'error') {
          const itemResolution = page.locator('.csv-item-resolution')
          if (fixture.itemResolution) {
            await expect(itemResolution).toBeVisible()
            await expect(itemResolution).toContainText(
              /unresolved items remaining/,
            )
            return
          }
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          return
        }

        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows.toLocaleString()} rows imported.`,
        )
      })
    } finally {
      const response = await page.request.delete(`/api/locations/${locationId}`)
      expect(response.status()).toBe(204)
    }
  }
})

test('imports the first purchase-order corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    await seedPurchaseOrderItems(page, locationId)
    for (const fixture of purchaseOrderBatchOneFixtures) {
      await test.step(`imports ${fixture.filename}`, async () => {
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('purchase_orders')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve(
              'tests/fixtures/csv/purchase-orders',
              fixture.filename,
            ),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows.toLocaleString()} rows · ${fixture.columns.length} columns · ${fixture.delimiter} delimited · ${fixture.encoding}`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows.toLocaleString()} rows imported.`,
        )
      })
    }
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test('imports the second purchase-order corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await assertAuthenticated(page)
  const locationId = await createTestLocation(page)

  try {
    await seedPurchaseOrderItems(page, locationId)
    for (const fixture of purchaseOrderBatchTwoFixtures) {
      await test.step(`imports ${fixture.filename}`, async () => {
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('purchase_orders')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve(
              'tests/fixtures/csv/purchase-orders',
              fixture.filename,
            ),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows.toLocaleString()} rows · ${fixture.columns.length} columns · ${fixture.delimiter} delimited · ${fixture.encoding}`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )

        if (fixture.outcome === 'error') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          return
        }

        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows.toLocaleString()} rows imported.`,
        )
      })
    }
  } finally {
    const response = await page.request.delete(`/api/locations/${locationId}`)
    expect(response.status()).toBe(204)
  }
})

test('imports the inventory corpus batch through /import', async ({ page }) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)
  for (const fixture of inventoryBatchFixtures) {
    const locationId = await createTestLocation(page)
    try {
      await test.step(`imports ${fixture.filename}`, async () => {
        await seedInventoryImportItems(page, locationId)
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('inventory')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/inventory', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows} rows · ${fixture.columns.length} columns · , delimited · utf-8`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )

        if (fixture.outcome === 'error') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          return
        }

        if ('unmatchedItems' in fixture && fixture.unmatchedItems) {
          await expect(page.locator('.csv-item-resolution')).toContainText(
            `${fixture.unmatchedItems} unresolved items remaining`,
          )
        }
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows} rows imported.`,
        )
      })
    } finally {
      const response = await page.request.delete(`/api/locations/${locationId}`)
      expect(response.status()).toBe(204)
    }
  }
})

test('imports the labor corpus batch through /import', async ({ page }) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)

  for (const fixture of laborBatchFixtures) {
    const locationId = await createTestLocation(page)
    try {
      await test.step(`imports ${fixture.filename}`, async () => {
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('labor')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/labor', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help'),
        ).toContainText(
          `${fixture.rows} rows · ${fixture.columns.length} columns · , delimited · utf-8`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )

        if (fixture.outcome === 'error') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          return
        }

        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.rows} rows imported.`,
        )
      })
    } finally {
      const response = await page.request.delete(`/api/locations/${locationId}`)
      expect(response.status()).toBe(204)
    }
  }
})

test('imports the malformed CSV corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)

  for (const fixture of malformedBatchFixtures) {
    const locationId = await createTestLocation(page)
    try {
      await test.step(`checks ${fixture.filename}`, async () => {
        if (fixture.outcome === 'error')
          await seedInventoryItems(page, locationId, [
            'Salmon Fillet',
            'House Salad',
            'Tomato Soup',
          ])
        else if (
          fixture.outcome === 'success' &&
          fixture.rows > 0 &&
          (fixture.filename === 'quotes-embedded-newlines.csv' ||
            fixture.filename === 'quotes-escaped-doubled.csv' ||
            fixture.filename === 'blank-lines-and-trailing-whitespace.csv')
        )
          await seedInventoryItems(page, locationId, [
            'Salmon Fillet',
            'House Salad',
          ])
        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('transactions')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/malformed', fixture.filename),
          )
        await page.getByRole('button', { name: 'Upload CSV' }).click()

        if (fixture.outcome === 'rejected') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          await expect(page.locator('#csv-preview-title')).toHaveCount(0)
          return
        }

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help').first(),
        ).toContainText(
          `${fixture.rows} rows · ${fixture.columns.length} columns`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        if ('error' in fixture && fixture.error) {
          await expect(page.locator('.csv-preview')).toContainText(
            fixture.error,
          )
        }

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )

        if (fixture.outcome === 'error') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.importError,
          )
          return
        }

        if ('unresolvedItems' in fixture && fixture.unresolvedItems) {
          await expect(page.locator('.csv-item-resolution')).toContainText(
            `${fixture.unresolvedItems} unresolved item${fixture.unresolvedItems === 1 ? '' : 's'} remaining`,
          )
        }
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toBeVisible()
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.importedRows} rows imported.`,
        )
      })
    } finally {
      const response = await page.request.delete(`/api/locations/${locationId}`)
      expect(response.status()).toBe(204)
    }
  }
})

test('checks the security CSV corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await assertAuthenticated(page)

  for (const fixture of securityBatchFixtures) {
    const locationId = await createTestLocation(page)
    try {
      await test.step(`checks ${fixture.filename}`, async () => {
        if (fixture.filename === 'formula-injection.csv')
          await seedInventoryItems(page, locationId)

        await page.goto(`/import?locationId=${locationId}`)
        await page.locator('#import-type').selectOption('transactions')
        await page
          .locator('#csv-file')
          .setInputFiles(
            path.resolve('tests/fixtures/csv/security', fixture.filename),
          )
        const uploadResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/uploads?') &&
            response.request().method() === 'POST',
        )
        await page.getByRole('button', { name: 'Upload CSV' }).click()
        const response = await uploadResponse
        expect(response.status()).toBe(
          fixture.outcome === 'rejected' ? 400 : 201,
        )

        if (fixture.outcome === 'rejected') {
          await expect(page.locator('p[role="alert"]')).toContainText(
            fixture.error,
          )
          await expect(page.locator('#csv-preview-title')).toHaveCount(0)
          return
        }

        await expect(page.locator('#csv-preview-title')).toBeVisible()
        await expect(
          page.locator('.csv-preview .app-page__help').first(),
        ).toContainText(
          `${fixture.rows} rows · ${fixture.columns.length} columns · , delimited · utf-8`,
        )
        expect(
          await page.locator('.csv-preview thead th').allTextContents(),
        ).toEqual(fixture.columns)

        await reviewMapping(page)
        await expect(page.locator('.csv-mapping')).toContainText(
          /Mapping reviewed|All columns matched|reused your last mapping/,
        )
        await expect(page.locator('.csv-item-resolution')).toContainText(
          `${fixture.unresolvedItems} unresolved items remaining`,
        )
        await resolveNewItems(page)
        await expect(
          page
            .locator('.csv-import-confirmation')
            .getByRole('heading', { name: /Ready to import/ }),
        ).toContainText(`${fixture.importedRows} rows`)
        await page.getByRole('button', { name: 'Import now' }).click()
        await expect(page.locator('.app-page__status')).toContainText(
          `${fixture.importedRows} rows imported.`,
        )
      })
    } finally {
      const response = await page.request.delete(`/api/locations/${locationId}`)
      expect(response.status()).toBe(204)
    }
  }
})
