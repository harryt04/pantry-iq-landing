import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  new URL('../app/(app)/settings/page.tsx', import.meta.url),
  'utf8',
)
const surface = readFileSync(
  new URL('../components/settings/account-settings.tsx', import.meta.url),
  'utf8',
)
const auth = readFileSync(
  new URL('../src/server/auth/auth.ts', import.meta.url),
  'utf8',
)

describe('account settings contract', () => {
  it('renders authenticated account details and editable profile fields', () => {
    expect(page).toContain('auth.api.getSession({ headers: await headers() })')
    expect(page).toContain('<AccountSettings')
    expect(surface).toContain('Name')
    expect(surface).toContain('Company name (optional)')
    expect(surface).toContain('Primary email')
    expect(surface).toContain('authClient.updateUser')
  })

  it('requires email verification and gives password changes a session boundary', () => {
    expect(auth).toContain('emailVerification:')
    expect(auth).toContain('changeEmail:')
    expect(auth).toContain('updateEmailWithoutVerification: false')
    expect(surface).toContain('authClient.changeEmail')
    expect(surface).toContain('revokeOtherSessions: true')
    expect(surface).toContain('Other sessions were signed out.')
  })

  it('uses real labels and text status/error regions', () => {
    expect(surface).toContain('<Label htmlFor="account-name">')
    expect(surface).toContain('<Label htmlFor="current-password">')
    expect(surface).toContain('role="status"')
    expect(surface).toContain('role="alert"')
  })
})
