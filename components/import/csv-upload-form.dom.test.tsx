import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CsvUploadForm } from './csv-upload-form'

/**
 * Replaces tests/csv-upload-contract.test.ts, whose component assertions were
 * `expect(form).toContain('CSV files up to 10 MB')`. That passes if the string
 * sits in a dead branch. These tests drive the form and watch what a user sees.
 */

const LOCATION_ID = 'location-1'
const fetchMock = vi.fn()

function csvFile(
  name = 'sales.csv',
  contents = 'date,item\n2026-08-01,salmon\n',
) {
  return new File([contents], name, {
    type: 'text/csv',
  })
}

/** The full preview shape the form renders after a successful upload. */
function csvPreview() {
  return {
    encoding: 'utf-8' as const,
    delimiter: ',' as const,
    hasHeader: true,
    columns: ['Date', 'Item', 'Quantity'],
    columnCount: 3,
    rowCount: 1,
    readableRowCount: 1,
    previewRows: [{ rowNumber: 1, values: ['2026-08-01', 'salmon', '2'] }],
    problems: [],
    mapping: {
      importType: 'transactions' as const,
      mapping: { Date: 'transactedAt', Item: 'rawItemName', Quantity: 'qty' },
      reused: false,
      columns: [
        {
          sourceColumn: 'Date',
          sourceIndex: 0,
          targetField: 'transactedAt' as const,
          confidence: 0.98,
          band: 'auto' as const,
          evidence: ['header match'],
          candidates: [],
        },
        {
          sourceColumn: 'Item',
          sourceIndex: 1,
          targetField: 'rawItemName' as const,
          confidence: 0.95,
          band: 'auto' as const,
          evidence: ['header match'],
          candidates: [],
        },
        {
          sourceColumn: 'Quantity',
          sourceIndex: 2,
          targetField: 'qty' as const,
          confidence: 0.94,
          band: 'auto' as const,
          evidence: ['header match'],
          candidates: [],
        },
      ],
    },
  }
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }
}

function mockSuccessfulBatch() {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/preview')) {
      const preview = csvPreview()
      return Promise.resolve(
        jsonResponse({
          preview: {
            ...preview,
            mapping: {
              ...preview.mapping,
              columns: preview.mapping.columns.map((column, index) =>
                index === 0
                  ? { ...column, band: 'review' as const, confidence: 0.7 }
                  : column,
              ),
            },
          },
        }),
      )
    }
    return Promise.resolve(
      jsonResponse({
        upload: {
          id: `upload-${fetchMock.mock.calls.length}`,
          filename: 'selected.csv',
        },
      }),
    )
  })
}

describe('CSV upload form', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    // A test can end while an upload's later fetch calls (e.g. the preview
    // request after the initial upload) are still in flight. Give those a
    // few ticks to settle against this test's own mock before the next
    // test's beforeEach resets it — otherwise the straggler call fires
    // during the next test and silently consumes its queued response.
    for (let tick = 0; tick < 10; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('states the size ceiling before the user picks a file', () => {
    render(<CsvUploadForm locationId={LOCATION_ID} />)

    expect(screen.getByText(/CSV files up to 10 MB/)).toBeInTheDocument()
  })

  it('starts uploading as soon as a file is chosen', async () => {
    render(<CsvUploadForm locationId={LOCATION_ID} />)

    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/uploads?locationId=${LOCATION_ID}`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('accepts several selected files and gives each one its own upload job', async () => {
    mockSuccessfulBatch()

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
      csvFile('inventory.csv'),
    ])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    expect(
      screen.getByRole('heading', { name: 'sales.csv' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'labor.csv' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'inventory.csv' }),
    ).toBeInTheDocument()
  })

  it('keeps the five-step path visible and works one file at a time', async () => {
    mockSuccessfulBatch()

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
    ])

    const steps = screen.getByRole('navigation', { name: 'Import steps' })
    expect(within(steps).getByText('Location')).toBeInTheDocument()
    expect(within(steps).getByText('Upload file')).toBeInTheDocument()
    expect(within(steps).getByText('Map columns')).toBeInTheDocument()
    expect(within(steps).getByText('Match items')).toBeInTheDocument()
    expect(within(steps).getByText('Confirm import')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(steps).getByText('Map columns').closest('li'),
      ).toHaveAttribute('aria-current', 'step'),
    )

    expect(
      screen.getAllByRole('heading', {
        name: "Let's place the uncertain columns.",
      }),
    ).toHaveLength(1)
    await userEvent.click(
      screen.getByRole('button', { name: 'Work on labor.csv' }),
    )
    expect(
      screen.getAllByRole('heading', {
        name: "Let's place the uncertain columns.",
      }),
    ).toHaveLength(1)
  })

  it('detects each file type and keeps an override on its own job', async () => {
    const uploadedTypes: string[] = []
    const overriddenTypes: string[] = []
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))

      if (url.includes('/type')) {
        overriddenTypes.push(
          (JSON.parse(init.body as string) as { importType: string })
            .importType,
        )
        return Promise.resolve(jsonResponse({ source: 'labor' }))
      }

      if (url.includes('/mapping'))
        return Promise.resolve(jsonResponse({ mapping: {} }))

      if (url.includes('/commit'))
        return Promise.resolve(
          jsonResponse({
            summary: {
              uploadId: 'upload-1',
              filename: 'selected.csv',
              importType: 'transactions',
              rowsToImport: 1,
              rowsImported: 0,
              newItems: 0,
              linkedItems: 0,
              alreadyImported: false,
              ready: true,
              unmatchedItems: [],
              items: [],
            },
          }),
        )

      uploadedTypes.push(
        (init.headers as Record<string, string>)['x-pantryiq-import-type']!,
      )
      return Promise.resolve(
        jsonResponse({
          upload: {
            id: `upload-${uploadedTypes.length}`,
            filename: 'selected.csv',
          },
        }),
      )
    })

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv', 'Date,Item,Qty\n2026-08-01,salmon,2\n'),
      csvFile(
        'labor.csv',
        'Shift Start,Shift End,Role,Actual Hours\n2026-08-01T10:00,2026-08-01T18:00,Line cook,8\n',
      ),
    ])

    await waitFor(() =>
      expect(uploadedTypes).toEqual(['transactions', 'labor']),
    )
    const salesType = screen.getByLabelText('Import type for sales.csv')
    const laborType = screen.getByLabelText('Import type for labor.csv')
    expect(salesType).toHaveValue('transactions')
    expect(laborType).toHaveValue('labor')

    await userEvent.selectOptions(salesType, 'labor')
    expect(salesType).toHaveValue('labor')
    expect(laborType).toHaveValue('labor')
    await waitFor(() => expect(overriddenTypes).toEqual(['labor']))
  })

  it('accepts three files from the drop target without a submit click', async () => {
    mockSuccessfulBatch()

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    const fileInput = screen.getByLabelText('CSV file')
    fireEvent.drop(screen.getByRole('form', { name: 'CSV upload drop zone' }), {
      dataTransfer: {
        files: [
          csvFile('sales.csv'),
          csvFile('labor.csv'),
          csvFile('inventory.csv'),
        ],
      },
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    expect(fileInput).toHaveClass('csv-upload__input')
    expect(screen.getAllByRole('heading', { name: /\.csv$/ })).toHaveLength(3)
  })

  it('sends the filename and import type as headers, not a multipart form', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    // Wait for the whole upload chain to settle, not just the first fetch:
    // an unawaited second call would otherwise still be in flight when this
    // test ends and could consume a later test's queued mock response.
    await screen.findByText('sales.csv is ready to map.')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/api/uploads?locationId=${LOCATION_ID}`)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'x-pantryiq-filename': 'sales.csv',
      'x-pantryiq-import-type': 'transactions',
    })
    // A buffered FormData would defeat the streaming upload route.
    expect(init.body).toBeInstanceOf(File)
  })

  it('reports the server message and promises nothing was saved on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: 'That file is not a CSV.' },
        { ok: false, status: 400 },
      ),
    )

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(
      await screen.findByText('That file is not a CSV.'),
    ).toBeInTheDocument()
  })

  it('falls back to an honest message when the server sends no reason', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
  })

  it('announces progress politely rather than trapping focus', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    const status = await screen.findByText('sales.csv is ready to map.')

    // Progress is announced through a live region, so a screen-reader user
    // hears it without the form stealing focus mid-upload.
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('does not leave the button spinning after a failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: 'Storage is unavailable.' },
        { ok: false, status: 503 },
      ),
    )

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    await screen.findByText('Storage is unavailable.')
    expect(screen.getByRole('button', { name: 'Upload CSV' })).toBeEnabled()
  })

  it("keeps an earlier file's preview when a later file fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'That file is not a CSV.' },
          { ok: false, status: 400 },
        ),
      )

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    const fileInput = screen.getByLabelText('CSV file')

    await userEvent.upload(fileInput, csvFile('sales.csv'))
    await screen.findByText('sales.csv is ready to map.')

    await userEvent.upload(fileInput, csvFile('bad.csv'))

    expect(
      await screen.findByText('That file is not a CSV.'),
    ).toBeInTheDocument()
    expect(screen.getByText('sales.csv is ready to map.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'A look at the first rows.' }),
    ).toBeInTheDocument()
  })

  it('isolates one rejected file and lets it retry without disturbing valid files', async () => {
    let rejectedAttempts = 0
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      if (url.includes('/mapping'))
        return Promise.resolve(jsonResponse({ mapping: {} }))
      if (url.includes('/commit'))
        return Promise.resolve(
          jsonResponse({
            summary: {
              uploadId: 'upload-1',
              filename: 'selected.csv',
              importType: 'transactions',
              rowsToImport: 1,
              rowsImported: 0,
              newItems: 0,
              linkedItems: 1,
              alreadyImported: false,
              ready: true,
              unmatchedItems: [],
              items: [],
            },
          }),
        )

      const headers = init.headers as Record<string, string> | undefined
      if (
        headers?.['x-pantryiq-filename'] === 'bad.csv' &&
        rejectedAttempts++ === 0
      ) {
        return Promise.resolve(
          jsonResponse(
            { error: 'That file is not a CSV.' },
            { ok: false, status: 400 },
          ),
        )
      }

      return Promise.resolve(
        jsonResponse({
          upload: {
            id: `upload-${fetchMock.mock.calls.length}`,
            filename: 'selected.csv',
          },
        }),
      )
    })

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('bad.csv'),
      csvFile('inventory.csv'),
    ])

    const badJob = screen
      .getByRole('heading', { name: 'bad.csv' })
      .closest('section')
    expect(badJob).not.toBeNull()
    expect(await within(badJob!).findByRole('alert')).toHaveTextContent(
      'That file is not a CSV.',
    )
    expect(
      within(badJob!).getByRole('button', { name: 'Try again with bad.csv' }),
    ).toBeVisible()
    expect(
      within(badJob!).getByRole('button', { name: 'Remove bad.csv' }),
    ).toBeVisible()
    expect(
      await within(
        screen.getByRole('heading', { name: 'sales.csv' }).closest('section')!,
      ).findByText('A look at the first rows.'),
    ).toBeInTheDocument()
    expect(
      await within(
        screen
          .getByRole('heading', { name: 'inventory.csv' })
          .closest('section')!,
      ).findByText('A look at the first rows.'),
    ).toBeInTheDocument()

    await userEvent.click(
      within(badJob!).getByRole('button', { name: 'Try again with bad.csv' }),
    )

    await waitFor(() =>
      expect(
        within(badJob!).getByText('A look at the first rows.'),
      ).toBeVisible(),
    )
    expect(
      within(
        screen.getByRole('heading', { name: 'sales.csv' }).closest('section')!,
      ).getByText('A look at the first rows.'),
    ).toBeInTheDocument()
    expect(
      within(
        screen
          .getByRole('heading', { name: 'inventory.csv' })
          .closest('section')!,
      ).getByText('A look at the first rows.'),
    ).toBeInTheDocument()
  })

  it('removes a rejected file without removing the other file jobs', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))

      const headers = init.headers as Record<string, string> | undefined
      if (headers?.['x-pantryiq-filename'] === 'bad.csv')
        return Promise.resolve(
          jsonResponse(
            { error: 'That file is not a CSV.' },
            { ok: false, status: 400 },
          ),
        )

      return Promise.resolve(
        jsonResponse({
          upload: { id: 'upload-good', filename: 'selected.csv' },
        }),
      )
    })

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('bad.csv'),
    ])

    const badJob = screen
      .getByRole('heading', { name: 'bad.csv' })
      .closest('section')
    expect(badJob).not.toBeNull()
    await within(badJob!).findByRole('alert')

    await userEvent.click(
      within(badJob!).getByRole('button', { name: 'Remove bad.csv' }),
    )

    expect(
      screen.queryByRole('heading', { name: 'bad.csv' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'sales.csv' }),
    ).toBeInTheDocument()
  })
})
