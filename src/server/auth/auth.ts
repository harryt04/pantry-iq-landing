import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'

import { db } from '@/src/server/db/client'
import { account, session, user, verification } from '@/src/server/db/schema'

import { sendAuthEmail } from './email'

const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET is required in production.')
}

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ?? 'local-development-secret-change-me',
  baseURL: baseUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user: resetUser, url }) => {
      await sendAuthEmail({
        to: resetUser.email,
        subject: 'Reset your PantryIQ password',
        text: `Use this link to reset your PantryIQ password: ${url}`,
      })
    },
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
})
