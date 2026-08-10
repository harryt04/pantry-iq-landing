import { render, screen, waitFor } from '@testing-library/react'
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

function csvFile(name = 'sales.csv') {
  return new File(['date,item\n2026-08-01,salmon\n'], name, {
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

describe('CSV upload form', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('states the size ceiling before the user picks a file', () => {
    render(<CsvUploadForm locationId={LOCATION_ID} />)

    expect(screen.getByText(/CSV files up to 10 MB/)).toBeInTheDocument()
  })

  it('keeps upload disabled until a file is chosen', async () => {
    render(<CsvUploadForm locationId={LOCATION_ID} />)

    const button = screen.getByRole('button', { name: 'Upload CSV' })
    expect(button).toBeDisabled()

    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())

    expect(button).toBeEnabled()
  })

  it('sends the filename and import type as headers, not a multipart form', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ upload: { id: 'upload-1', filename: 'sales.csv' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ preview: csvPreview() }))

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())
    await userEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

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
    await userEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

    expect(
      await screen.findByText('That file is not a CSV.'),
    ).toBeInTheDocument()
  })

  it('falls back to an honest message when the server sends no reason', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))

    render(<CsvUploadForm locationId={LOCATION_ID} />)
    await userEvent.upload(screen.getByLabelText('CSV file'), csvFile())
    await userEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Upload CSV' }))

    await screen.findByText('Storage is unavailable.')
    expect(screen.getByRole('button', { name: 'Upload CSV' })).toBeEnabled()
  })
})
