import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `components/locations/location-manager.tsx` was 452 untested lines in the
 * 2026-08-10 audit. Deleting a location destroys every import under it, so the
 * rules that matter are that the user is told what will be lost before they
 * confirm, and that they cannot confirm before that number has loaded.
 */

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => '/account',
}))

const { LocationManager } = await import('./location-manager')

const LOCATION = {
  id: 'loc-1',
  name: 'North',
  address: '1 Main St',
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
}
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

/** Answers each endpoint the manager calls, newest override winning. */
function routeFetch(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/locations' && method === 'GET') {
      return jsonResponse(overrides.list ?? { locations: [LOCATION] })
    }
    if (url.startsWith('/api/locations/') && method === 'GET') {
      return jsonResponse(
        overrides.summary ?? {
          summary: { importCount: 3, importedRowCount: 1240 },
        },
      )
    }
    if (url.startsWith('/api/locations/') && method === 'DELETE') {
      return (
        overrides.delete ?? { ok: true, status: 204, json: async () => ({}) }
      )
    }
    if (url === '/api/locations' && method === 'POST') {
      return jsonResponse(overrides.create ?? { location: LOCATION }, {
        status: 201,
      })
    }
    return jsonResponse({})
  })
}

async function openDeleteDialog() {
  render(<LocationManager />)
  await screen.findByText('North')
  await userEvent.click(screen.getByRole('button', { name: /Remove|Delete/ }))
}

describe('location manager', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    refresh.mockReset()
    routeFetch()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the locations the account owns', async () => {
    render(<LocationManager />)

    expect(await screen.findByText('North')).toBeInTheDocument()
  })

  it('states exactly what a delete will destroy', async () => {
    await openDeleteDialog()

    expect(await screen.findByText(/Remove North\?/)).toBeInTheDocument()
    expect(
      await screen.findByText(/This deletes 3 imports and 1,240 imported rows/),
    ).toBeInTheDocument()
  })

  it('will not let the user confirm before the count has loaded', async () => {
    let releaseSummary: (() => void) | undefined
    routeFetch({
      summary: undefined,
    })
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url === '/api/locations' && method === 'GET')
        return jsonResponse({ locations: [LOCATION] })
      if (url.startsWith('/api/locations/') && method === 'GET') {
        await new Promise<void>((resolve) => {
          releaseSummary = resolve
        })
        return jsonResponse({
          summary: { importCount: 3, importedRowCount: 1240 },
        })
      }
      return jsonResponse({})
    })

    await openDeleteDialog()

    expect(
      await screen.findByText(/Loading the data that will be removed/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove location' }),
    ).toBeDisabled()

    releaseSummary?.()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove location' }),
      ).toBeEnabled(),
    )
  })

  it('offers a way out that changes nothing', async () => {
    await openDeleteDialog()
    await screen.findByText(/This deletes 3 imports/)

    await userEvent.click(screen.getByRole('button', { name: 'Keep location' }))

    const deleteCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
    )
    expect(deleteCalls).toHaveLength(0)
  })

  it('deletes only after the user confirms', async () => {
    await openDeleteDialog()
    await screen.findByText(/This deletes 3 imports/)

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove location' }),
    )

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
      )
      expect(deleteCalls).toHaveLength(1)
      expect(deleteCalls[0]?.[0]).toBe(`/api/locations/${LOCATION.id}`)
    })
  })

  it('reports a failed delete rather than pretending it worked', async () => {
    routeFetch({
      delete: {
        ok: false,
        status: 500,
        json: async () => ({
          error: 'That location could not be removed. Try again.',
        }),
      },
    })

    await openDeleteDialog()
    await screen.findByText(/This deletes 3 imports/)
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove location' }),
    )

    expect(await screen.findByText(/could not be removed/)).toBeInTheDocument()
  })
})
