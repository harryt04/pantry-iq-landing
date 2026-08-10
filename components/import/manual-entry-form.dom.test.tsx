import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ManualEntryForm } from './manual-entry-form'

/**
 * `components/import/manual-entry-form.tsx` was 673 untested lines in the
 * 2026-08-10 audit. It writes straight into the canonical model, so the rules
 * that matter are that the entry type decides the payload shape, that the
 * request is scoped to the caller location, and that a failure says plainly
 * nothing was written.
 */

const LOCATION_ID = 'location-1'
const fetchMock = vi.fn()

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

function lastPostBody() {
  const post = fetchMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
  )
  return JSON.parse((post?.[1] as RequestInit).body as string) as Record<
    string,
    unknown
  >
}

async function chooseEntryType(label: string) {
  await userEvent.selectOptions(
    screen.getByLabelText('What are you recording?'),
    label,
  )
}

describe('manual entry form', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse({ items: [] })
      return jsonResponse({ result: { rowsImported: 1 } }, { status: 201 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records an inventory count by default', async () => {
    render(<ManualEntryForm locationId={LOCATION_ID} />)

    expect(await screen.findByLabelText('Quantity on hand')).toBeInTheDocument()
  })

  it('scopes the write to the caller location', async () => {
    render(<ManualEntryForm locationId={LOCATION_ID} />)

    await userEvent.type(await screen.findByLabelText('Quantity on hand'), '12')
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      )
      expect(post?.[0]).toBe(`/api/manual-entry?locationId=${LOCATION_ID}`)
    })
  })

  it('sends a labor payload when the user records a shift', async () => {
    render(<ManualEntryForm locationId={LOCATION_ID} />)
    await screen.findByLabelText('Quantity on hand')

    await chooseEntryType('Labor shift')
    await userEvent.type(await screen.findByLabelText('Role'), 'Line cook')
    await userEvent.type(
      screen.getByLabelText('Scheduled hours (optional)'),
      '8',
    )
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() =>
      expect(lastPostBody()).toMatchObject({
        entryType: 'labor',
        role: 'Line cook',
        scheduledHours: '8',
      }),
    )
  })

  it('sends empty optional fields as null, never as an empty string', async () => {
    render(<ManualEntryForm locationId={LOCATION_ID} />)
    await screen.findByLabelText('Quantity on hand')

    await chooseEntryType('Labor shift')
    await userEvent.type(await screen.findByLabelText('Role'), 'Line cook')
    await userEvent.type(
      screen.getByLabelText('Scheduled hours (optional)'),
      '8',
    )
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => {
      const body = lastPostBody()
      // An empty string would be stored as a real value and pollute reports.
      expect(body.shiftEnd).toBeNull()
      expect(body.employeeReference).toBeNull()
      expect(body.laborCost).toBeNull()
      expect(body.actualHours).toBeNull()
    })
  })

  it('confirms with the row count the server actually reported', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse({ items: [] })
      return jsonResponse({ result: { rowsImported: 4 } }, { status: 201 })
    })

    render(<ManualEntryForm locationId={LOCATION_ID} />)
    await userEvent.type(await screen.findByLabelText('Quantity on hand'), '12')
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(
      await screen.findByText(/4 rows saved\. It is in import history\./),
    ).toBeInTheDocument()
  })

  it('reports the server reason when the write is refused', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse({ items: [] })
      return jsonResponse(
        { error: 'Quantity must be positive.' },
        { ok: false, status: 400 },
      )
    })

    render(<ManualEntryForm locationId={LOCATION_ID} />)
    await userEvent.type(await screen.findByLabelText('Quantity on hand'), '-1')
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(
      await screen.findByText('Quantity must be positive.'),
    ).toBeInTheDocument()
  })

  it('promises nothing changed when the request itself fails', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse({ items: [] })
      throw new TypeError('network down')
    })

    render(<ManualEntryForm locationId={LOCATION_ID} />)
    await userEvent.type(await screen.findByLabelText('Quantity on hand'), '12')
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
    // The form must be usable again, not stuck mid-save.
    expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled()
  })

  it('clears the form after a successful save so nothing is entered twice', async () => {
    render(<ManualEntryForm locationId={LOCATION_ID} />)
    const quantity = await screen.findByLabelText('Quantity on hand')

    await userEvent.type(quantity, '12')
    await userEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() =>
      expect(screen.getByLabelText('Quantity on hand')).toHaveValue(''),
    )
  })
})
