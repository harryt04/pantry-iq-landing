import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatSurface } from './chat-surface'

/**
 * Replaces tests/chat-surface-contract.test.ts, which asserted the source
 * contained 'Answers stay within this location.' and "fetch('/api/chat'".
 *
 * The rules worth protecting are that the visible scope matches the request the
 * component actually sends, and that a question never goes out carrying another
 * location's id.
 */

const LOCATION_ID = 'location-1'
const fetchMock = vi.fn()

function streamingResponse(text: string) {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    }),
  }
}

function renderSurface(portfolioLocationCount = 3) {
  return render(
    <ChatSurface
      locationId={LOCATION_ID}
      locationName="North"
      recommendations={[]}
      portfolioLocationCount={portfolioLocationCount}
    />,
  )
}

async function ask(question: string) {
  const box = screen.getByRole('textbox')
  await userEvent.type(box, question)
  await userEvent.keyboard('{Enter}')
}

describe('chat surface', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(streamingResponse('Salmon is at risk.'))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tells the user the answer is scoped to one location', () => {
    renderSurface()

    expect(
      screen.getByText('Answers stay within this location.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/North/).length).toBeGreaterThan(0)
  })

  it('sends the question to the chat route with the current location', async () => {
    renderSurface()
    await ask('What is at risk?')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      locationId: LOCATION_ID,
      question: 'What is at risk?',
      scope: 'location',
    })
  })

  it('switches the request scope when the user asks across locations', async () => {
    renderSurface()

    await userEvent.click(
      screen.getByRole('button', { name: /Ask across all locations/ }),
    )
    await ask('How is the portfolio?')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { scope: string }
    expect(body.scope).toBe('portfolio')
  })

  it('offers no cross-location scope to an account with one location', () => {
    renderSurface(1)

    expect(
      screen.queryByRole('button', { name: /Ask across all locations/ }),
    ).not.toBeInTheDocument()
  })

  it('explains the keyboard contract for the composer', () => {
    renderSurface()

    expect(
      screen.getByText('Enter sends. Shift+Enter adds a new line.'),
    ).toBeInTheDocument()
  })

  it('does not send on Shift+Enter', async () => {
    renderSurface()

    await userEvent.type(screen.getByRole('textbox'), 'A partial thought')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to send an empty question', async () => {
    renderSurface()

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Enter}')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the streamed answer in the transcript', async () => {
    renderSurface()
    await ask('What is at risk?')

    expect(await screen.findByText(/Salmon is at risk\./)).toBeInTheDocument()
  })

  it('sends prior turns as history so the model has context', async () => {
    renderSurface()
    await ask('First question')
    await screen.findByText(/Salmon is at risk\./)

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(streamingResponse('Second answer.'))
    await ask('Second question')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { history: unknown[] }
    expect(body.history.length).toBeGreaterThan(0)
  })

  it('surfaces a failure instead of leaving the composer stuck', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'The chat response could not be started.' }),
    })

    renderSurface()
    await ask('What is at risk?')

    await waitFor(() => expect(screen.getByRole('textbox')).not.toBeDisabled())
  })
})
