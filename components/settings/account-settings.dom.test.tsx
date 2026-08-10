import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Replaces tests/account-settings-contract.test.ts, which asserted the source
 * contained 'authClient.updateUser' and 'revokeOtherSessions: true'.
 *
 * The rules worth protecting are the client-side password checks, and that a
 * password change signs other sessions out. A source-text test proves neither.
 */

const updateUser = vi.fn()
const changeEmail = vi.fn()
const changePassword = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    updateUser: (...args: unknown[]) => updateUser(...args),
    changeEmail: (...args: unknown[]) => changeEmail(...args),
    changePassword: (...args: unknown[]) => changePassword(...args),
  },
}))

const { AccountSettings } = await import('./account-settings')

const STRONG_PASSWORD = 'correct-horse-battery'

function renderSettings() {
  return render(
    <AccountSettings
      initialName="Owner"
      initialCompanyName="PantryIQ"
      initialEmail="owner@example.com"
    />,
  )
}

async function submitPasswordChange({
  current = 'old-password-1',
  next = STRONG_PASSWORD,
  confirm = STRONG_PASSWORD,
} = {}) {
  await userEvent.type(screen.getByLabelText('Current password'), current)
  await userEvent.type(screen.getByLabelText('New password'), next)
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('account settings', () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({ error: null })
    changeEmail.mockReset().mockResolvedValue({ error: null })
    changePassword.mockReset().mockResolvedValue({ error: null })
  })

  it('signs other sessions out when the password changes', async () => {
    renderSettings()
    await submitPasswordChange()

    await waitFor(() => expect(changePassword).toHaveBeenCalled())
    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ revokeOtherSessions: true }),
    )
  })

  it('tells the user other sessions were signed out', async () => {
    renderSettings()
    await submitPasswordChange()

    expect(
      await screen.findByText(
        'Your password is changed. Other sessions were signed out.',
      ),
    ).toBeInTheDocument()
  })

  it('refuses a short password without calling the server', async () => {
    renderSettings()
    await submitPasswordChange({ next: 'short', confirm: 'short' })

    expect(
      await screen.findByText(
        'Use at least 12 characters for your new password.',
      ),
    ).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('refuses a mismatched confirmation without calling the server', async () => {
    renderSettings()
    await submitPasswordChange({ confirm: 'a-different-password' })

    expect(
      await screen.findByText('The new passwords do not match.'),
    ).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('clears the password fields after a successful change', async () => {
    renderSettings()
    await submitPasswordChange()

    await screen.findByText(/Other sessions were signed out/)
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('does not echo the password back in an error message', async () => {
    changePassword.mockResolvedValue({ error: { message: 'nope' } })
    renderSettings()
    await submitPasswordChange()

    const error = await screen.findByText(/could not be saved/)
    expect(error.textContent).not.toContain(STRONG_PASSWORD)
  })

  it('saves profile details through the auth client', async () => {
    renderSettings()

    const nameInput = screen.getByLabelText('Name')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'New Owner')
    await userEvent.click(
      screen.getByRole('button', { name: 'Save account details' }),
    )

    await waitFor(() => expect(updateUser).toHaveBeenCalled())
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Owner' }),
    )
  })

  it('only changes the email when the user actually changed it', async () => {
    renderSettings()

    await userEvent.click(
      screen.getByRole('button', { name: 'Save account details' }),
    )

    await waitFor(() => expect(updateUser).toHaveBeenCalled())
    expect(changeEmail).not.toHaveBeenCalled()
  })
})
