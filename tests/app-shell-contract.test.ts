import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const shell = readFileSync(
  new URL('../components/app/app-shell.tsx', import.meta.url),
  'utf8',
)
const serverShell = readFileSync(
  new URL('../components/app/app-shell-server.tsx', import.meta.url),
  'utf8',
)
const mobileLoading = readFileSync(
  new URL('../app/(app)/loading.tsx', import.meta.url),
  'utf8',
)

describe('authenticated app shell contract', () => {
  it('keeps the core navigation and location scope visible in the header', () => {
    for (const label of ['Dashboard', 'Chat', 'Import', 'Settings']) {
      expect(shell).toContain(`label: '${label}'`)
    }

    expect(shell).toContain('aria-label="Selected location"')
    expect(shell).toContain('Viewing')
    expect(shell).toContain('pantryiq-location-id')
    expect(shell).not.toMatch(/Donate|donate/)
  })

  it('routes accounts without an active location to location setup', () => {
    expect(serverShell).toContain(
      "if (locations.length === 0) redirect('/account')",
    )
    expect(serverShell).toContain('.filter((location) => location.isActive)')
  })

  it('uses a layout-shaped loading skeleton instead of a full-page spinner', () => {
    expect(mobileLoading).toContain('app-page__skeleton--heading')
    expect(mobileLoading).toContain('app-page__skeleton--card')
    expect(mobileLoading).not.toMatch(/Spinner|spinner/i)
  })
})
