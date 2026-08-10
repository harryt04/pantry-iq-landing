import { readFileSync } from 'node:fs'

import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

/**
 * The one place that asserts on words.
 *
 * These rules are genuinely about text, so matching text is the right tool.
 * The improvement over the contract tests the 2026-08-10 audit found is that
 * these check **rendered output**, not source files. A banned phrase now fails
 * whether it is inlined in JSX, imported from a constant, or built at runtime.
 *
 * The markdown check stays a file read, because a document is the artifact.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/components/auth/sign-out-button', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}))

const { DashboardDataState } =
  await import('@/components/dashboard/dashboard-data-state')
const { AppShell } = await import('@/components/app/app-shell')
const { default: LandingPage } = await import('@/app/page')

/**
 * Claims the product cannot currently stand behind. Retired promises and
 * unshipped flows both live here so there is one list to update when a feature
 * actually ships.
 */
const UNSUPPORTED_CLAIMS = [
  'Ask it anything.',
  'Under 5 min',
  'Upload to first insight',
  'Traceable to a row you uploaded',
  'surplus to a shelter nearby',
  'Messy is fine',
  'Offer to a shelter',
] as const

/** Words that make a data gap sound like the user's fault, or trivial. */
const DISMISSIVE_WORDS = /\b(simply|just merely)\b/i

function renderedSurfaces(): Array<{ name: string; markup: string }> {
  const dataStates = (['empty', 'insufficient'] as const).map((status) => ({
    name: `dashboard data state (${status})`,
    markup: renderToStaticMarkup(
      <DashboardDataState
        locationId="location-1"
        state={{
          status,
          transactionDays: status === 'empty' ? 0 : 3,
          requiredDays: 7,
          remainingDays: status === 'empty' ? 7 : 4,
        }}
      />,
    ),
  }))

  const shell = {
    name: 'app shell',
    markup: renderToStaticMarkup(
      <AppShell
        locations={[{ id: 'loc-1', name: 'North' }]}
        initialLocationId="loc-1"
      >
        <p>body</p>
      </AppShell>,
    ),
  }

  const landing = {
    name: 'landing page',
    markup: renderToStaticMarkup(<LandingPage />),
  }

  return [...dataStates, shell, landing]
}

describe('copy rules', () => {
  it.each(renderedSurfaces())(
    'publishes no unsupported claim in the $name',
    ({ markup }) => {
      for (const claim of UNSUPPORTED_CLAIMS) {
        expect(markup, claim).not.toContain(claim)
      }
    },
  )

  it('does not belittle a data gap in the dashboard empty states', () => {
    for (const { name, markup } of renderedSurfaces()) {
      if (!name.startsWith('dashboard data state')) continue
      expect(markup, name).not.toMatch(DISMISSIVE_WORDS)
    }
  })

  it('keeps donation language out of the authenticated shell', () => {
    const shell = renderedSurfaces().find(({ name }) => name === 'app shell')
    expect(shell?.markup).not.toMatch(/donate|donation|shelter/i)
  })

  it('keeps the retired chat promise out of the marketing document', () => {
    const marketingCopy = readFileSync(
      new URL('../docs/brand/marketing-copy.md', import.meta.url),
      'utf8',
    )

    expect(marketingCopy).not.toContain('3. **Ask it anything.')
  })
})
