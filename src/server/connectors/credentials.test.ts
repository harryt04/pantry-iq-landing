import { describe, expect, it } from 'vitest'

import {
  decryptConnectorTokens,
  encryptConnectorTokens,
  hashOAuthState,
} from './credentials'

describe('connector credential protection', () => {
  const secret = 'test-secret'
  const tokens = {
    accessToken: 'access-value',
    refreshToken: 'refresh-value',
    scope: 'orders.read',
    accessTokenExpiresAt: new Date('2026-08-09T12:00:00.000Z'),
  }

  it('round-trips tokens without storing plaintext', () => {
    const encrypted = encryptConnectorTokens(tokens, secret)
    expect(encrypted).toMatch(/^v1\./)
    expect(encrypted).not.toContain(tokens.accessToken)
    expect(encrypted).not.toContain(tokens.refreshToken)
    expect(decryptConnectorTokens(encrypted, secret)).toEqual(tokens)
  })

  it('rejects tampering and an incorrect key', () => {
    const encrypted = encryptConnectorTokens(tokens, secret)
    const [version, iv, tag, ciphertext] = encrypted.split('.')
    if (!ciphertext) throw new Error('Encrypted credentials had no ciphertext.')
    const replacement = ciphertext[0] === 'a' ? 'b' : 'a'
    const tampered = `${version}.${iv}.${tag}.${replacement}${ciphertext.slice(1)}`
    expect(() => decryptConnectorTokens(tampered, secret)).toThrow(
      'Unable to decrypt connector credentials.',
    )
    expect(() => decryptConnectorTokens(encrypted, 'wrong-secret')).toThrow(
      'Unable to decrypt connector credentials.',
    )
  })

  it('hashes OAuth state without retaining the bearer value', () => {
    expect(hashOAuthState('state')).toHaveLength(64)
    expect(hashOAuthState('state')).toBe(hashOAuthState('state'))
    expect(hashOAuthState('state')).not.toBe('state')
  })
})
