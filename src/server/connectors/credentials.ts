import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

import type { ConnectorTokens } from './types'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

function keyFromSecret(secret: string): Buffer {
  const key = createHash('sha256').update(secret).digest()
  return key
}

function secretFromEnvironment(): string {
  const secret = process.env.CONNECTOR_CREDENTIAL_KEY
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CONNECTOR_CREDENTIAL_KEY is required in production.')
  }
  return secret ?? 'local-development-connector-key-change-me'
}

/**
 * Encrypts provider tokens as versioned AES-256-GCM data. The database only
 * receives this opaque value; tokens must never be passed to the logger.
 */
export function encryptConnectorTokens(
  tokens: ConnectorTokens,
  secret = secretFromEnvironment(),
): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secret), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptConnectorTokens(
  encrypted: string,
  secret = secretFromEnvironment(),
): ConnectorTokens {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split('.')
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Unsupported connector credential format.')
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      keyFromSecret(secret),
      Buffer.from(ivValue, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const parsed: unknown = JSON.parse(plaintext)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { accessToken?: unknown }).accessToken !== 'string'
    ) {
      throw new Error('Connector credentials are malformed.')
    }
    const value = parsed as ConnectorTokens & {
      accessTokenExpiresAt?: string | Date
      refreshTokenExpiresAt?: string | Date
    }
    if (typeof value.accessTokenExpiresAt === 'string')
      value.accessTokenExpiresAt = new Date(value.accessTokenExpiresAt)
    if (typeof value.refreshTokenExpiresAt === 'string')
      value.refreshTokenExpiresAt = new Date(value.refreshTokenExpiresAt)
    return value
  } catch {
    throw new Error('Unable to decrypt connector credentials.')
  }
}

export function hashOAuthState(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}
