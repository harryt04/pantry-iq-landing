'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

import type { auth } from '@/src/server/auth/auth'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
    : {}),
})
