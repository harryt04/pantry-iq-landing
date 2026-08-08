'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

import { authClient } from '@/lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'reset'

const copy: Record<
  AuthMode,
  { title: string; description: string; submit: string }
> = {
  'sign-in': {
    title: 'Sign in to PantryIQ',
    description: 'Pick up where you left off with your restaurant data.',
    submit: 'Sign in',
  },
  'sign-up': {
    title: 'Start with one location',
    description:
      'Create your owner account. You can add your first location next.',
    submit: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    description:
      'Enter your email and we’ll send a reset link if an account uses it.',
    submit: 'Send reset link',
  },
  reset: {
    title: 'Choose a new password',
    description:
      'Use at least 12 characters. Your other sessions will be signed out.',
    submit: 'Reset password',
  },
}

function errorMessage() {
  return 'That did not work. Check the details and try again.'
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [token] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('token') ?? ''),
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    setNotice(undefined)

    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
        })
        if (result.error) throw new Error(result.error.message)
        window.location.assign('/account')
        return
      }

      if (mode === 'sign-in') {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) throw new Error(result.error.message)
        window.location.assign('/account')
        return
      }

      if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (result.error) throw new Error(result.error.message)
        setNotice('If an account uses that email, a reset link is on its way.')
        return
      }

      if (!token) throw new Error('Missing reset token.')
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (result.error) throw new Error(result.error.message)
      setNotice(
        'Your password was reset. You can sign in with the new password.',
      )
    } catch {
      setError(errorMessage())
    } finally {
      setBusy(false)
    }
  }

  const currentCopy = copy[mode]

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-wordmark" href="/" aria-label="PantryIQ home">
          PantryIQ
        </Link>
        <div className="auth-heading">
          <p className="auth-eyebrow">Account</p>
          <h1 id="auth-title">{currentCopy.title}</h1>
          <p>{currentCopy.description}</p>
        </div>

        {notice ? (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="auth-form" onSubmit={submit}>
          {mode === 'sign-up' ? (
            <label>
              Name
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}

          {mode !== 'reset' ? (
            <label>
              Email
              <input
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          ) : null}

          {mode === 'sign-in' || mode === 'sign-up' || mode === 'reset' ? (
            <label>
              {mode === 'reset' ? 'New password' : 'Password'}
              <input
                autoComplete={
                  mode === 'sign-in' ? 'current-password' : 'new-password'
                }
                minLength={12}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : null}

          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : currentCopy.submit}
          </button>
        </form>

        <nav className="auth-links" aria-label="Account links">
          {mode === 'sign-in' ? (
            <>
              <Link href="/forgot-password">Forgot your password?</Link>
              <span>
                New to PantryIQ? <Link href="/sign-up">Create an account</Link>
              </span>
            </>
          ) : null}
          {mode === 'sign-up' ? (
            <span>
              Already have an account? <Link href="/sign-in">Sign in</Link>
            </span>
          ) : null}
          {mode === 'forgot' ? (
            <Link href="/sign-in">Back to sign in</Link>
          ) : null}
          {mode === 'reset' ? (
            <Link href="/sign-in">Back to sign in</Link>
          ) : null}
        </nav>
      </section>
    </main>
  )
}
