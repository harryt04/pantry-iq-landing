import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/src/server/db/client', () => ({ db: {} }))

import { auth } from './auth'
import { sendAuthEmail } from './email'

const fetchMock = vi.fn<typeof fetch>()

function response(status: number) {
  return new Response(null, { status })
}

function authUser(email: string) {
  return {
    id: 'user-1',
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    name: 'PantryIQ Operator',
    email,
    emailVerified: false,
  }
}

describe('authentication email delivery', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('AUTH_EMAIL_FROM', 'PantryIQ <auth@example.test>')
    fetchMock.mockResolvedValue(response(200))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('delivers the authentication message through the configured provider', async () => {
    await sendAuthEmail({
      to: 'operator@example.test',
      subject: 'Reset your PantryIQ password',
      text: 'Use this link to reset your PantryIQ password: https://example.test/reset',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PantryIQ <auth@example.test>',
        to: ['operator@example.test'],
        subject: 'Reset your PantryIQ password',
        text: 'Use this link to reset your PantryIQ password: https://example.test/reset',
      }),
    })
  })

  it('connects both Better Auth flows to authentication-only messages', async () => {
    await auth.options.emailAndPassword.sendResetPassword?.({
      user: authUser('reset@example.test'),
      url: 'https://example.test/reset',
      token: 'reset-token',
    })
    await auth.options.emailVerification.sendVerificationEmail?.({
      user: authUser('verify@example.test'),
      url: 'https://example.test/verify',
      token: 'verify-token',
    })

    const messages = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    )

    expect(messages).toEqual([
      {
        from: 'PantryIQ <auth@example.test>',
        to: ['reset@example.test'],
        subject: 'Reset your PantryIQ password',
        text: 'Use this link to reset your PantryIQ password: https://example.test/reset',
      },
      {
        from: 'PantryIQ <auth@example.test>',
        to: ['verify@example.test'],
        subject: 'Verify your PantryIQ email',
        text: 'Verify your PantryIQ email address by opening this link: https://example.test/verify',
      },
    ])
    expect(
      messages.every((message) =>
        /password|email/i.test(`${message.subject} ${message.text}`),
      ),
    ).toBe(true)
    expect(
      messages.some((message) =>
        /notification|digest|recommendation/i.test(
          `${message.subject} ${message.text}`,
        ),
      ),
    ).toBe(false)
  })

  it('omits delivery in local development when the provider is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('AUTH_EMAIL_FROM', '')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    await sendAuthEmail({
      to: 'operator@example.test',
      subject: 'Verify your PantryIQ email',
      text: 'Open the verification link.',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith(
      '[auth email omitted in local development]',
      {
        to: 'operator@example.test',
        subject: 'Verify your PantryIQ email',
        text: 'Open the verification link.',
      },
    )
  })

  it('fails closed in production when authentication delivery is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('AUTH_EMAIL_FROM', '')

    await expect(
      sendAuthEmail({
        to: 'operator@example.test',
        subject: 'Reset your PantryIQ password',
        text: 'Open the reset link.',
      }),
    ).rejects.toThrow('Authentication email delivery is not configured.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces provider failures instead of silently accepting them', async () => {
    fetchMock.mockResolvedValue(response(503))

    await expect(
      sendAuthEmail({
        to: 'operator@example.test',
        subject: 'Verify your PantryIQ email',
        text: 'Open the verification link.',
      }),
    ).rejects.toThrow('Authentication email delivery failed (503).')
  })
})
