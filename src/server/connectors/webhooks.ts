import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Provider adapters use this primitive after extracting the provider's
 * signature header. It deliberately compares bytes in constant time and
 * rejects missing or malformed values before a payload can be accepted.
 */
export function verifyHmacWebhookSignature(input: {
  rawBody: string
  signature: string | null
  secret: string
  encoding?: 'hex' | 'base64'
}): boolean {
  if (!input.signature || !input.secret) return false
  const encoding = input.encoding ?? 'hex'
  const expected = createHmac('sha256', input.secret)
    .update(input.rawBody)
    .digest()
  const supplied = Buffer.from(input.signature, encoding)
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  )
}
