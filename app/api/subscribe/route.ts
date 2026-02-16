import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

export async function POST(request: NextRequest) {
  const posthog = getPostHogClient()

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 },
      )
    }

    // Identify user on server side
    posthog.identify({
      distinctId: email,
      properties: {
        email,
      },
    })

    // Forward to the external API
    posthog.capture({
      distinctId: email,
      event: 'launch-signup',
      properties: {
        email,
        source: 'api',
      },
    })
    await posthog.shutdown()
    await fetch('https://harryt.dev/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        usesApps: ['pantryiq'],
        status: 'activeCustomer',
      }),
    }).catch(() => {
      // Ignore errors from external call as specified
    })

    return NextResponse.json(
      { message: 'Successfully subscribed!' },
      { status: 200 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    )
  }
}
