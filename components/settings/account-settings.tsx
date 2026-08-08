'use client'

import * as React from 'react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AccountSettingsProps = {
  initialCompanyName: string
  initialEmail: string
  initialName: string
}

export function AccountSettings({
  initialCompanyName,
  initialEmail,
  initialName,
}: AccountSettingsProps) {
  const [name, setName] = React.useState(initialName)
  const [companyName, setCompanyName] = React.useState(initialCompanyName)
  const [email, setEmail] = React.useState(initialEmail)
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [profileStatus, setProfileStatus] = React.useState<string>()
  const [profileError, setProfileError] = React.useState<string>()
  const [passwordStatus, setPasswordStatus] = React.useState<string>()
  const [passwordError, setPasswordError] = React.useState<string>()
  const [profileBusy, setProfileBusy] = React.useState(false)
  const [passwordBusy, setPasswordBusy] = React.useState(false)

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileBusy(true)
    setProfileError(undefined)
    setProfileStatus(undefined)

    const nextName = name.trim()
    const nextCompanyName = companyName.trim()
    const nextEmail = email.trim().toLowerCase()

    if (!nextName) {
      setProfileError('Add a name so your account is identifiable.')
      setProfileBusy(false)
      return
    }

    try {
      const profileResult = await authClient.updateUser({
        name: nextName,
        companyName: nextCompanyName || null,
      })
      if (profileResult.error) throw new Error(profileResult.error.message)

      if (nextEmail !== initialEmail.toLowerCase()) {
        const emailResult = await authClient.changeEmail({
          callbackURL: '/settings',
          newEmail: nextEmail,
        })
        if (emailResult.error) throw new Error(emailResult.error.message)
        setProfileStatus(
          'Your account details are saved. Verify the new email address before it takes effect.',
        )
      } else {
        setProfileStatus('Your account details are saved.')
      }
    } catch {
      setProfileError(
        'That account change could not be saved. Check the details and try again.',
      )
    } finally {
      setProfileBusy(false)
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordBusy(true)
    setPasswordError(undefined)
    setPasswordStatus(undefined)

    if (newPassword.length < 12) {
      setPasswordError('Use at least 12 characters for your new password.')
      setPasswordBusy(false)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      setPasswordBusy(false)
      return
    }

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (result.error) throw new Error(result.error.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus(
        'Your password is changed. Other sessions were signed out.',
      )
    } catch {
      setPasswordError(
        'That password change could not be saved. Check the details and try again.',
      )
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="settings-layout">
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Account basics</CardTitle>
          <CardDescription>
            Keep the name and company details tied to your owner account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="settings-form" onSubmit={saveProfile}>
            <div className="settings-field">
              <Label htmlFor="account-name">Name</Label>
              <Input
                autoComplete="name"
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="company-name">Company name (optional)</Label>
              <Input
                autoComplete="organization"
                id="company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="account-email">Primary email</Label>
              <Input
                autoComplete="email"
                id="account-email"
                inputMode="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="settings-help">
                A new address takes effect after you verify it.
              </p>
            </div>
            {profileError ? (
              <p className="settings-error" role="alert">
                {profileError}
              </p>
            ) : null}
            {profileStatus ? (
              <p className="settings-status" role="status">
                {profileStatus}
              </p>
            ) : null}
            <Button disabled={profileBusy} type="submit">
              {profileBusy ? 'Saving…' : 'Save account details'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing it signs out every other PantryIQ session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="settings-form" onSubmit={changePassword}>
            <div className="settings-field">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                autoComplete="current-password"
                id="current-password"
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="new-password">New password</Label>
              <Input
                autoComplete="new-password"
                id="new-password"
                minLength={12}
                required
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                autoComplete="new-password"
                id="confirm-password"
                minLength={12}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {passwordError ? (
              <p className="settings-error" role="alert">
                {passwordError}
              </p>
            ) : null}
            {passwordStatus ? (
              <p className="settings-status" role="status">
                {passwordStatus}
              </p>
            ) : null}
            <Button disabled={passwordBusy} type="submit">
              {passwordBusy ? 'Changing…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
