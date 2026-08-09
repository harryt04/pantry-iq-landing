export type RetryPolicy = {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
}

export const connectorRetryPolicy: RetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
}

export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy = connectorRetryPolicy,
): number {
  if (!Number.isInteger(attempt) || attempt < 1)
    throw new Error('Retry attempt must be a positive integer.')
  return Math.min(policy.maxDelayMs, policy.initialDelayMs * 2 ** (attempt - 1))
}

export function isRetryableConnectorError(error: unknown): boolean {
  if (
    error instanceof Error &&
    error.name === 'ConnectorAuthorizationRevokedError'
  )
    return false
  if (error instanceof Error && 'retryable' in error)
    return (error as Error & { retryable?: unknown }).retryable === true
  return true
}

export async function withConnectorRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = connectorRetryPolicy,
  sleep: (delayMs: number) => Promise<void> = (delayMs) =>
    new Promise((resolve) => setTimeout(resolve, delayMs)),
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= policy.maxAttempts || !isRetryableConnectorError(error))
        throw error
      await sleep(retryDelayMs(attempt, policy))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Connector retry failed.')
}
