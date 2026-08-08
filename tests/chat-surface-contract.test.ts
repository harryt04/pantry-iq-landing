import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const surface = readFileSync(
  new URL('../components/chat/chat-surface.tsx', import.meta.url),
  'utf8',
)
const primitives = readFileSync(
  new URL('../components/chat/chat-primitives.tsx', import.meta.url),
  'utf8',
)
const page = readFileSync(
  new URL('../app/(app)/chat/page.tsx', import.meta.url),
  'utf8',
)

describe('chat surface contract', () => {
  it('keeps chat scoped and useful before the answering service exists', () => {
    expect(surface).toContain('Answers stay within this location.')
    expect(surface).toContain('SUGGESTED_QUESTIONS')
    expect(surface).toContain('streamStubbedReply')
    expect(surface).toContain(
      'The grounded answering service will use checked operational data here.',
    )
  })

  it('uses accessible transcript and composer semantics', () => {
    expect(primitives).toContain('aria-live="polite"')
    expect(primitives).toContain('aria-label="Chat transcript"')
    expect(surface).toContain('Enter sends. Shift+Enter adds a new line.')
    expect(surface).toContain('requestSubmit()')
    expect(surface).toContain('Ask a question about {locationName}')
  })

  it('renders the selected location into the chat route', () => {
    expect(page).toContain('getAppShellData()')
    expect(page).toContain('<ChatSurface')
    expect(page).toContain('locationName={location.name}')
  })
})
