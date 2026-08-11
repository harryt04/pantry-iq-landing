import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const password = 'pantryiq-critical-path-2026'

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

async function signInOrSignUp(page: Page) {
  const email = process.env.TEST_USER_EMAIL
  const configuredPassword = process.env.TEST_USER_PASSWORD

  if (email && configuredPassword) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(configuredPassword)
    await page.getByRole('button', { name: /Sign in/ }).click()
    await expect(page).toHaveURL(/\/(dashboard|account)(\?|$)/)
    return
  }

  const fallbackEmail = `transaction-batch-${Date.now()}@example.test`
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Transaction Batch Operator')
  await page.getByLabel('Email').fill(fallbackEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
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

async function seedInventoryItems(page: Page, locationId: string) {
  for (const displayName of [
    'Salmon Fillet',
    'House Salad',
    'Tomato Soup',
    'Bubble Tea',
    'Burger',
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

test('signup, location, CSV import, and dashboard', async ({ page }) => {
  const email = `critical-path-${Date.now()}@example.test`

  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Critical Path Operator')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/account$/)
  await expect(
    page.getByRole('heading', { name: 'Manage your locations.' }),
  ).toBeVisible()

  await page.getByLabel('Location name').fill('Critical Path Kitchen')
  await page.getByLabel('Address').fill('100 Test Street')
  await page.getByRole('button', { name: 'Add location' }).click()
  await expect(page.getByRole('status')).toContainText('Location added.')

  await page.getByRole('link', { name: 'View dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard\?locationId=/)
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
      name: 'Start with the data you already have.',
    }),
  ).toBeVisible()
  await expect(page.getByText('1 / 7 days')).toBeVisible()
})

test('imports the first transaction corpus batch through /import', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInOrSignUp(page)
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
  await signInOrSignUp(page)
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
  await signInOrSignUp(page)

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
  await signInOrSignUp(page)
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
  await signInOrSignUp(page)
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
  await signInOrSignUp(page)
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
  await signInOrSignUp(page)

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
