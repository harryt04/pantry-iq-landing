import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

/**
 * Replaces tests/app-shell-contract.test.ts, which asserted the source
 * contained `label: 'Dashboard'` and friends. That passes even if the nav never
 * renders, and it breaks on a harmless rename.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/components/auth/sign-out-button', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}))

const { AppShell } = await import('./app-shell')

const LOCATIONS = [
  { id: 'loc-north', name: 'North' },
  { id: 'loc-south', name: 'South' },
]

function render(locations = LOCATIONS, initialLocationId = 'loc-north') {
  return renderToStaticMarkup(
    <AppShell locations={locations} initialLocationId={initialLocationId}>
      <p>page body</p>
    </AppShell>,
  )
}

describe('app shell', () => {
  it('renders every primary destination as a real link', () => {
    const markup = render()

    for (const label of [
      'Dashboard',
      'Portfolio',
      'Chat',
      'Import',
      'Usage',
      'Staffing',
      'Settings',
    ]) {
      expect(markup, label).toContain(`>${label}<`)
    }
  })

  it('carries the selected location through every navigation link', () => {
    const markup = render()

    for (const path of ['/dashboard', '/chat', '/import', '/settings']) {
      expect(markup, path).toContain(`href="${path}?locationId=loc-north"`)
    }
  })

  it('names the location the user is currently viewing', () => {
    const markup = render(LOCATIONS, 'loc-south')

    expect(markup).toContain('South')
    expect(markup).toContain('Viewing')
  })

  it('labels the location control for screen readers', () => {
    expect(render()).toContain('aria-label="Selected location"')
  })

  it('renders the page body it is given', () => {
    expect(render()).toContain('<p>page body</p>')
  })

  it('escapes a location id inside navigation links', () => {
    const markup = render([{ id: 'a&b', name: 'Odd' }], 'a&b')

    expect(markup).toContain('locationId=a%26b')
    expect(markup).not.toContain('locationId=a&b"')
  })

  it('still renders navigation when the account has one location', () => {
    const markup = render([{ id: 'only', name: 'Only' }], 'only')

    expect(markup).toContain('>Dashboard<')
    expect(markup).toContain('Only')
  })
})
