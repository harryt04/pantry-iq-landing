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
const overrideRoute = readFileSync(
  new URL('../app/api/chat/override/route.ts', import.meta.url),
  'utf8',
)
const overrideEngine = readFileSync(
  new URL('../src/server/chat/assumption-override.ts', import.meta.url),
  'utf8',
)

describe('chat surface contract', () => {
  it('keeps chat scoped and connected to the answering service', () => {
    expect(surface).toContain('Answers stay within this location.')
    expect(surface).toContain('Ask across all locations')
    expect(surface).toContain("scope === 'portfolio'")
    expect(surface).toContain('SUGGESTED_QUESTIONS')
    expect(surface).toContain("fetch('/api/chat'")
    expect(surface).toContain('locationId')
    expect(surface).toContain('history: messages.map')
  })

  it('uses accessible transcript and composer semantics', () => {
    expect(primitives).toContain('aria-live="polite"')
    expect(primitives).toContain('aria-label="Chat transcript"')
    expect(surface).toContain('Enter sends. Shift+Enter adds a new line.')
    expect(surface).toContain('requestSubmit()')
    expect(surface).toContain('Ask a question about')
  })

  it('renders the selected location into the chat route', () => {
    expect(page).toContain('getAppShellData()')
    expect(page).toContain('<ChatSurface')
    expect(page).toContain('locationName={location.name}')
    expect(page).toContain('key={location.id}')
    expect(surface).toContain('setMessages([])')
    expect(surface).toContain('}, [locationId])')
  })

  it('requires an explicit scope after an engine-backed assumption comparison', () => {
    expect(surface).toContain('Question an assumption')
    expect(surface).toContain('This conversation only')
    expect(surface).toContain('Save to item settings')
    expect(surface).toContain("fetch('/api/chat/override'")
    expect(surface).toContain('overrides,')
    expect(overrideRoute).toContain('requireOwnedLocation')
    expect(overrideRoute).toContain('compareAssumptionOverride')
    expect(overrideEngine).toContain("'deterministic-precompute'")
    expect(overrideEngine).toContain('buildPrecomputeResults')
  })
})
