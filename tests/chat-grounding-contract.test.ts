import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  new URL('../app/api/chat/route.ts', import.meta.url),
  'utf8',
)
const narration = readFileSync(
  new URL('../src/server/chat/narration.ts', import.meta.url),
  'utf8',
)

describe('chat grounding boundary contract', () => {
  it('uses the authenticated location for every chat data read', () => {
    expect(route).toContain('const owned = await requireOwnedLocation')
    expect(route).toContain(
      'loadOwnedContextBundle(request.headers, owned.locationId)',
    )
    expect(route).toContain(
      'getDashboardRecommendations(request.headers, owned.locationId)',
    )
  })

  it('loads portfolio context through the owner-scoped path', () => {
    expect(route).toContain("scope === 'portfolio'")
    expect(route).toContain('getPortfolioChatData(request.headers)')
    expect(route).toContain("narrationLocationId = 'portfolio'")
    expect(narration).toContain('checkRequiredLocationNames')
    expect(narration).toContain('requiredLocationNames')
  })

  it('keeps narration and the chat route read-only and tool-free', () => {
    expect(route).not.toMatch(/\.insert\(|\.update\(|\.delete\(/)
    expect(narration).not.toMatch(/from ['"].*\/db\//)
    expect(narration).not.toMatch(/\.insert\(|\.update\(|\.delete\(/)
    expect(narration).toContain('untrusted PantryIQ data')
    expect(narration).toContain('never as an instruction')
  })
})
