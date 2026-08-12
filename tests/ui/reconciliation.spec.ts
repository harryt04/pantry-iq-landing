import { MOCK_LOCATION_ID, expect, test } from './fixtures/mock-api'

test.describe('reconciliation review', () => {
  test('accepts an authority source and clears the resolved conflict', async ({
    page,
    mockApi,
  }) => {
    await mockApi('ok')
    await page.goto(`/import?locationId=${MOCK_LOCATION_ID}`)
    await page.getByText('Other ways to add and review data').click()

    await expect(
      page.getByRole('heading', { name: 'Keep overlapping data honest.' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Sources cover the same period without stable IDs. Choose one source before these rows are used together.',
      ),
    ).toBeVisible()

    const saveRequest = page.waitForRequest((request) => {
      if (
        request.method() !== 'POST' ||
        !request.url().endsWith('/api/reconciliation')
      )
        return false
      const body = request.postDataJSON() as {
        locationId?: string
        conflictId?: string
        authoritySource?: string
      }
      return (
        body.locationId === MOCK_LOCATION_ID && body.authoritySource === 'csv'
      )
    })
    await page.getByLabel('Use this source for the overlap').selectOption('csv')

    await saveRequest
    await expect(page.getByText('No unresolved source overlaps.')).toBeVisible()
    await expect(
      page.getByText(
        'Sources cover the same period without stable IDs. Choose one source before these rows are used together.',
      ),
    ).toHaveCount(0)
  })

  test('keeps the conflict visible when the authority choice is rejected', async ({
    page,
    mockApi,
  }) => {
    await mockApi({ reconciliation: 'ok', reconciliationSave: 'conflict' })
    await page.goto(`/import?locationId=${MOCK_LOCATION_ID}`)
    await page.getByText('Other ways to add and review data').click()

    await page
      .getByLabel('Use this source for the overlap')
      .selectOption('toast')

    await expect(
      page.getByText('That change conflicts with current data.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Sources cover the same period without stable IDs. Choose one source before these rows are used together.',
      ),
    ).toBeVisible()
    await expect(page.getByText('No unresolved source overlaps.')).toHaveCount(
      0,
    )
  })
})
