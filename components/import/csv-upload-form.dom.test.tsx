import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CsvUploadForm } from './csv-upload-form'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

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

async function renderOpenImport() {
  render(<CsvUploadForm locationId={LOCATION_ID} />)
  await userEvent.click(screen.getByRole('button', { name: 'Import data' }))
}

describe('CSV upload form', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
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

  it('states the size ceiling before the user picks a file', async () => {
    await renderOpenImport()

    expect(screen.getByText(/CSV files up to 10 MB/)).toBeInTheDocument()
  })

  it('opens the import flow in a desktop dialog', async () => {
    await renderOpenImport()

    const dialog = screen.getByTestId('csv-import-dialog')
    expect(dialog).toBeInTheDocument()
    expect(
      within(dialog).getByRole('form', {
        name: 'CSV upload drop zone',
      }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Step 1 of 4')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('progressbar', {
        name: 'Import progress: step 1 of 4',
      }),
    ).toHaveAttribute('aria-valuenow', '25')
  })

  it('opens the import flow in a mobile sheet', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
    })

    try {
      await renderOpenImport()

      await waitFor(() =>
        expect(screen.getByTestId('csv-import-sheet')).toBeInTheDocument(),
      )
      expect(
        within(screen.getByTestId('csv-import-sheet')).getByRole('form', {
          name: 'CSV upload drop zone',
        }),
      ).toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      })
    }
  })

  it('confirms close, keeps saved work resumable, and can discard it', async () => {
    mockSuccessfulBatch()

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())
    await screen.findByRole('heading', { name: 'sales.csv' })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.getByRole('heading', { name: 'Close this import?' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('csv-import-dialog')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Keep files for later' }),
    )
    expect(screen.queryByTestId('csv-import-dialog')).not.toBeInTheDocument()
    expect(
      window.localStorage.getItem(`pantryiq-import-jobs:${LOCATION_ID}`),
    ).toEqual(expect.any(String))
    expect(
      screen.getByRole('button', { name: 'Resume import' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Resume import' }))
    expect(screen.getByRole('heading', { name: 'sales.csv' })).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard saved progress' }),
    )
    expect(screen.queryByTestId('csv-import-dialog')).not.toBeInTheDocument()
    expect(
      window.localStorage.getItem(`pantryiq-import-jobs:${LOCATION_ID}`),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Import data' }),
    ).toBeInTheDocument()
  })

  it('does not reuse a persisted queue id for a new upload', async () => {
    window.localStorage.setItem(
      `pantryiq-import-jobs:${LOCATION_ID}`,
      JSON.stringify({
        activeJobId: 'upload-job-0',
        jobs: {
          'upload-job-0': {
            fileName: 'old.csv',
            importType: 'transactions',
            detectedImportType: 'transactions',
            uploadId: 'old-upload',
            preview: null,
            mapping: null,
            resolutions: {},
            summary: null,
            status: 'old.csv is ready to continue.',
            error: '',
            isUploading: false,
            isCommitting: false,
            isCommitted: false,
          },
        },
      }),
    )
    mockSuccessfulBatch()

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resume import' }))
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Work on old.csv' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Working on sales.csv' }),
      ).toBeInTheDocument()
    })
  })

  it('starts uploading as soon as a file is chosen', async () => {
    await renderOpenImport()

    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/uploads?locationId=${LOCATION_ID}`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows one compact queue entry per file and only renders the active detail', async () => {
    mockSuccessfulBatch()

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
      csvFile('inventory.csv'),
    ])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    const queue = screen.getByRole('navigation', {
      name: 'Files in this import',
    })
    expect(within(queue).getAllByRole('button')).toHaveLength(3)
    expect(
      within(queue).getByRole('button', { name: 'Working on sales.csv' }),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(queue).getByRole('button', { name: 'Work on labor.csv' }),
    ).toHaveTextContent('Map columns')
    expect(
      within(queue).getByRole('button', { name: 'Work on inventory.csv' }),
    ).toHaveTextContent('Map columns')
    expect(screen.getByRole('heading', { name: 'sales.csv' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'labor.csv' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Preview of labor.csv' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(queue).getByRole('button', { name: 'Work on labor.csv' }),
    )
    expect(screen.getByRole('heading', { name: 'labor.csv' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'sales.csv' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Preview of labor.csv' }),
    ).toBeInTheDocument()
  })

  it('keeps navigation and commit actions in the pinned footer', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      if (url.includes('/mapping'))
        return Promise.resolve(jsonResponse({ mapping: csvPreview().mapping }))
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
      return Promise.resolve(
        jsonResponse({ upload: { id: 'upload-1', filename: 'selected.csv' } }),
      )
    })

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
    ])

    const footer = await screen.findByRole('contentinfo', {
      name: 'Import actions',
    })
    expect(footer).toHaveClass('csv-import-overlay__footer')
    expect(footer.previousElementSibling).toHaveClass(
      'csv-import-overlay__scroll',
    )
    expect(within(footer).getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(
      within(footer).getByRole('button', { name: 'Next file' }),
    ).toBeEnabled()
    expect(
      within(footer).getByRole('button', { name: 'Import 2 ready files' }),
    ).toBeVisible()

    await userEvent.click(
      within(footer).getByRole('button', { name: 'Next file' }),
    )
    expect(screen.getByRole('heading', { name: 'labor.csv' })).toBeVisible()
    expect(within(footer).getByRole('button', { name: 'Back' })).toBeEnabled()
  })

  it('persists every automatic mapping before preparing a batch', async () => {
    const savedMappings = new Set<string>()
    const dryRunUploads: string[] = []
    const mappingUploads: string[] = []

    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      const pathname = new URL(url, 'http://localhost').pathname
      if (pathname === '/api/uploads') {
        const filename = (init.headers as Record<string, string>)[
          'x-pantryiq-filename'
        ]
        return Promise.resolve(
          jsonResponse({
            upload: { id: `upload-${filename}`, filename },
          }),
        )
      }

      const uploadId = pathname.split('/')[3] ?? ''
      if (pathname.endsWith('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))

      if (pathname.endsWith('/mapping')) {
        mappingUploads.push(uploadId)
        savedMappings.add(uploadId)
        return Promise.resolve(jsonResponse({ mapping: csvPreview().mapping }))
      }

      if (pathname.endsWith('/commit')) {
        const body = JSON.parse(init.body as string) as { dryRun?: boolean }
        if (body.dryRun) {
          dryRunUploads.push(uploadId)
          if (!savedMappings.has(uploadId))
            return Promise.resolve(
              jsonResponse(
                { error: 'That upload is not available to this account.' },
                { ok: false, status: 404 },
              ),
            )
          return Promise.resolve(
            jsonResponse({
              summary: {
                uploadId,
                filename: uploadId,
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
        }
        return Promise.resolve(
          jsonResponse({
            summary: {
              uploadId,
              filename: uploadId,
              importType: 'transactions',
              rowsToImport: 1,
              rowsImported: 1,
              newItems: 0,
              linkedItems: 1,
              alreadyImported: false,
              ready: true,
              unmatchedItems: [],
              items: [],
            },
          }),
        )
      }

      throw new Error(`Unexpected request: ${pathname}`)
    })

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
      csvFile('inventory.csv'),
    ])

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Import 3 ready files' }),
      ).toBeInTheDocument(),
    )
    expect(mappingUploads).toHaveLength(3)
    expect(dryRunUploads).toHaveLength(3)
    expect(dryRunUploads.every((uploadId) => savedMappings.has(uploadId))).toBe(
      true,
    )
    expect(screen.queryAllByRole('alert')).toHaveLength(0)

    await userEvent.click(
      screen.getByRole('button', { name: 'Import 3 ready files' }),
    )
    await screen.findByRole('heading', { name: 'Batch import complete.' })
    expect(toast.success).toHaveBeenCalledWith('Batch import complete.')
    expect(document.querySelectorAll('[aria-live="polite"]').length).toBe(1)
  })

  it('announces a failed batch commit through the toast channel', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      if (url.includes('/mapping'))
        return Promise.resolve(jsonResponse({ mapping: csvPreview().mapping }))
      if (url.includes('/commit')) {
        const body = JSON.parse(String(init.body)) as { dryRun?: boolean }
        if (body.dryRun)
          return Promise.resolve(
            jsonResponse({
              summary: {
                uploadId: 'upload-1',
                filename: 'sales.csv',
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
        return Promise.resolve(
          jsonResponse(
            { error: 'The import could not be completed.' },
            { ok: false, status: 500 },
          ),
        )
      }
      return Promise.resolve(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
    })

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
    ])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Import 2 ready files' }),
    )

    await screen.findByText('The import could not be completed.')
    expect(toast.error).toHaveBeenCalledWith(
      'The batch import could not be completed. Review the file error and try again.',
    )
  })

  it('keeps the existing upload API sequence and derives confirmation from the dry-run summary', async () => {
    const requests: string[] = []
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      const pathname = new URL(url, 'http://localhost').pathname
      requests.push(`${init.method ?? 'GET'} ${pathname}`)

      if (pathname === '/api/uploads')
        return Promise.resolve(
          jsonResponse({
            upload: { id: 'upload-1', filename: 'sales.csv' },
          }),
        )
      if (pathname.endsWith('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      if (pathname.endsWith('/mapping'))
        return Promise.resolve(jsonResponse({ mapping: csvPreview().mapping }))
      if (pathname.endsWith('/commit'))
        return Promise.resolve(
          jsonResponse({
            summary: {
              uploadId: 'upload-1',
              filename: 'sales.csv',
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

      throw new Error(`Unexpected request: ${pathname}`)
    })

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    await waitFor(() =>
      expect(screen.getByText('Step 4 of 4')).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('heading', { name: /Ready to import 1 rows/ }),
    ).toBeInTheDocument()
    expect(requests).toEqual([
      'POST /api/uploads',
      'GET /api/uploads/upload-1/preview',
      'PATCH /api/uploads/upload-1/mapping',
      'POST /api/uploads/upload-1/commit',
    ])
  })

  it('keeps the four-step path visible and works one file at a time', async () => {
    mockSuccessfulBatch()

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('labor.csv'),
    ])

    const steps = screen.getByRole('navigation', { name: 'Import steps' })
    expect(within(steps).getByText('Upload file')).toBeInTheDocument()
    expect(within(steps).getByText('Map columns')).toBeInTheDocument()
    expect(within(steps).getByText('Match items')).toBeInTheDocument()
    expect(within(steps).getByText('Confirm import')).toBeInTheDocument()
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4)
    expect(within(steps).queryByText('Location')).not.toBeInTheDocument()
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

    await renderOpenImport()
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
    expect(salesType).toHaveValue('transactions')

    await userEvent.selectOptions(salesType, 'labor')
    expect(salesType).toHaveValue('labor')
    await waitFor(() => expect(overriddenTypes).toEqual(['labor']))

    await userEvent.click(
      screen.getByRole('button', { name: 'Work on labor.csv' }),
    )
    expect(screen.getByLabelText('Import type for labor.csv')).toHaveValue(
      'labor',
    )
  })

  it('accepts three files from the drop target without a submit click', async () => {
    mockSuccessfulBatch()

    await renderOpenImport()
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
    expect(
      within(
        screen.getByRole('navigation', { name: 'Files in this import' }),
      ).getAllByRole('button'),
    ).toHaveLength(3)
  })

  it('applies the drag-over state while files are over the drop target', async () => {
    await renderOpenImport()
    const dropZone = screen.getByRole('form', {
      name: 'CSV upload drop zone',
    })

    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveClass('csv-upload-dropzone', 'is-dragging')

    fireEvent.dragLeave(dropZone)
    expect(dropZone).not.toHaveClass('is-dragging')
  })

  it('sends the filename and import type as headers, not a multipart form', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))

    await renderOpenImport()
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

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(
      await screen.findByText('That file is not a CSV.'),
    ).toBeInTheDocument()
  })

  it('falls back to an honest message when the server sends no reason', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
  })

  it('announces progress politely rather than trapping focus', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))

    await renderOpenImport()
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

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    await screen.findByText('Storage is unavailable.')
    expect(screen.getByRole('button', { name: 'Upload CSV' })).toBeEnabled()
  })

  it('shows the error state instead of a ready state when final import fails', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      if (url.includes('/mapping')) return Promise.resolve(jsonResponse({}))
      if (url.includes('/commit')) {
        const body = JSON.parse(String(init.body)) as { dryRun?: boolean }
        if (body.dryRun)
          return Promise.resolve(
            jsonResponse({
              summary: {
                uploadId: 'upload-1',
                filename: 'sales.csv',
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
        return Promise.resolve(
          jsonResponse(
            { error: 'The import could not be completed.' },
            { ok: false, status: 500 },
          ),
        )
      }
      return Promise.resolve(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
    })

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    const importButton = await screen.findByRole('button', {
      name: 'Import now',
    })
    await userEvent.click(importButton)

    const job = screen.getByRole('region', { name: 'sales.csv' })
    expect(await within(job).findByRole('alert')).toHaveTextContent(
      'The import could not be completed.',
    )
    expect(
      within(job).queryByRole('heading', { name: /Ready to import/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import now' })).toBeEnabled()
  })

  it('keeps an earlier file in the queue when a later file fails', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
      if (url.includes('/preview'))
        return Promise.resolve(jsonResponse({ preview: csvPreview() }))
      const filename = (init.headers as Record<string, string> | undefined)?.[
        'x-pantryiq-filename'
      ]
      if (filename === 'bad.csv')
        return Promise.resolve(
          jsonResponse(
            { error: 'That file is not a CSV.' },
            { ok: false, status: 400 },
          ),
        )
      return Promise.resolve(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
    })

    await renderOpenImport()
    const fileInput = screen.getByLabelText('CSV file')

    await userEvent.upload(fileInput, [
      csvFile('sales.csv'),
      csvFile('bad.csv'),
    ])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Work on bad.csv' }),
    )
    expect(
      await screen.findByText('That file is not a CSV.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sales\.csv/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Preview of sales.csv' }),
    ).not.toBeInTheDocument()
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

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('bad.csv'),
      csvFile('inventory.csv'),
    ])

    await userEvent.click(
      screen.getByRole('button', { name: 'Work on bad.csv' }),
    )
    const badJob = screen.getByRole('region', { name: 'bad.csv' })
    expect(await within(badJob).findByRole('alert')).toHaveTextContent(
      'That file is not a CSV.',
    )
    expect(
      within(badJob).getByRole('button', { name: 'Try again with bad.csv' }),
    ).toBeVisible()
    expect(
      within(badJob).getByRole('button', { name: 'Remove bad.csv' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Preview of sales.csv' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Preview of inventory.csv' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      within(badJob).getByRole('button', { name: 'Try again with bad.csv' }),
    )

    await waitFor(() =>
      expect(
        within(badJob).getByRole('heading', {
          name: 'A look at the first rows.',
          level: 3,
        }),
      ).toBeVisible(),
    )
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

    await renderOpenImport()
    await userEvent.upload(screen.getByLabelText('CSV file'), [
      csvFile('sales.csv'),
      csvFile('bad.csv'),
    ])

    await userEvent.click(
      screen.getByRole('button', { name: 'Work on bad.csv' }),
    )
    const badJob = screen.getByRole('region', { name: 'bad.csv' })
    await within(badJob).findByRole('alert')

    await userEvent.click(
      within(badJob).getByRole('button', { name: 'Remove bad.csv' }),
    )

    expect(
      screen.queryByRole('button', { name: /bad\.csv/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'sales.csv' }),
    ).toBeInTheDocument()
  })
})
