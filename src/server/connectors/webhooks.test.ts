import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { verifyHmacWebhookSignature } from './webhooks'

describe('connector webhook signature verification', () => {
  it('accepts the exact HMAC and rejects altered or unsigned payloads', () => {
    const rawBody = '{"event":"order.created"}'
    const secret = 'webhook-secret'
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex')

    expect(verifyHmacWebhookSignature({ rawBody, signature, secret })).toBe(
      true,
    )
    expect(
      verifyHmacWebhookSignature({
        rawBody: `${rawBody} `,
        signature,
        secret,
      }),
    ).toBe(false)
    expect(
      verifyHmacWebhookSignature({ rawBody, signature: null, secret }),
    ).toBe(false)
  })
})
