import { describe, expect, it, vi } from 'vitest'
import { createLogger, type StructuredLogEvent } from './logger'

function eventFrom(lines: string[]): StructuredLogEvent {
  const line = lines.at(-1)
  if (!line) throw new Error('Expected a log line')
  return JSON.parse(line) as StructuredLogEvent
}

describe('structured logger', () => {
  it('writes one JSON event with stable service context', () => {
    const lines: string[] = []
    const logger = createLogger({
      service: 'import-worker',
      sink: (line) => lines.push(line),
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    })

    logger.info('Import completed', {
      locationId: 'location-1',
      rowsImported: 42,
      durationMs: 1250,
    })

    expect(eventFrom(lines)).toEqual({
      timestamp: '2026-08-08T12:00:00.000Z',
      level: 'info',
      service: 'import-worker',
      message: 'Import completed',
      locationId: 'location-1',
      rowsImported: 42,
      durationMs: 1250,
    })
  })

  it('redacts secrets, imported rows, and secret-bearing text', () => {
    const lines: string[] = []
    const logger = createLogger({
      service: 'api',
      sink: (line) => lines.push(line),
    })

    logger.warn('Request failed with Bearer abc123', {
      password: 'correct horse battery staple',
      accessToken: 'abc123',
      inputTokens: 'secret-value',
      rawRow: { item: 'salmon', price: '12.00' },
      callbackUrl: 'https://example.test/callback?token=abc123&ok=1',
    } as never)

    const line = lines[0] ?? ''
    const event = eventFrom(lines)
    expect(event.password).toBe('[REDACTED]')
    expect(event.accessToken).toBe('[REDACTED]')
    expect(event.inputTokens).toBe('[REDACTED]')
    expect(event.rawRow).toBe('[REDACTED_IMPORTED_ROW]')
    expect(event.callbackUrl).toBe(
      'https://example.test/callback?token=[REDACTED]&ok=1',
    )
    expect(event.message).toBe('Request failed with Bearer [REDACTED]')
    expect(line).not.toContain('correct horse')
    expect(line).not.toContain('salmon')
    expect(line).not.toContain('abc123')
  })

  it('captures errors without sending unsafe context to the reporter', () => {
    const lines: string[] = []
    const captureException = vi.fn()
    const logger = createLogger({
      service: 'precompute-worker',
      sink: (line) => lines.push(line),
      errorReporter: { captureException },
    })
    const error = new Error('Database failed: Bearer secret-value')

    logger.error('Precompute failed', error, {
      locationId: 'location-1',
      token: 'secret-value',
    })

    expect(eventFrom(lines).errorMessage).toBe(
      'Database failed: Bearer [REDACTED]',
    )
    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        locationId: 'location-1',
        token: '[REDACTED]',
        errorMessage: 'Database failed: Bearer [REDACTED]',
      }),
    )
  })

  it('defensively redacts non-scalar fields from JavaScript callers', () => {
    const lines: string[] = []
    const logger = createLogger({
      service: 'api',
      sink: (line) => lines.push(line),
    })

    logger.info('Unexpected metadata', {
      metadata: { imported: 'salmon' },
    } as never)

    expect(eventFrom(lines).metadata).toBe('[REDACTED_NON_SCALAR]')
  })

  it('writes producer events with queryable ownership and exact cost fields', () => {
    const lines: string[] = []
    const logger = createLogger({
      service: 'operations',
      sink: (line) => lines.push(line),
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    })

    logger.precomputeSucceeded({
      locationId: 'location-1',
      runId: 'run-1',
      durationMs: 1250,
    })
    logger.importCompleted({
      accountId: 'account-1',
      locationId: 'location-1',
      importId: 'import-1',
      rowsImported: 42,
    })
    logger.llmQueryCompleted({
      accountId: 'account-1',
      queryId: 'query-1',
      model: 'claude-haiku-class',
      inputTokens: 3050,
      outputTokens: 500,
      costMicros: 3300,
      currency: 'USD',
    })
    logger.chatHistoryTrimmed({
      accountId: 'account-1',
      queryId: 'query-1',
      budgetTokens: 400,
      originalTokens: 612,
      retainedTokens: 400,
      omittedMessages: 2,
    })
    logger.chatMissRecorded({
      accountId: 'account-1',
      locationId: 'location-1',
      queryId: 'query-1',
      question: 'Did my supplier raise prices?',
      reason: 'outside-grounding',
    })

    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      event: 'precompute.completed',
      locationId: 'location-1',
      runId: 'run-1',
      durationMs: 1250,
    })
    expect(JSON.parse(lines[1] ?? '')).toMatchObject({
      event: 'import.completed',
      accountId: 'account-1',
      locationId: 'location-1',
      importId: 'import-1',
      rowsImported: 42,
    })
    expect(JSON.parse(lines[2] ?? '')).toMatchObject({
      event: 'llm.query.completed',
      accountId: 'account-1',
      inputTokens: 3050,
      outputTokens: 500,
      costMicros: 3300,
      currency: 'USD',
    })
    expect(JSON.parse(lines[3] ?? '')).toMatchObject({
      event: 'chat.history.trimmed',
      accountId: 'account-1',
      budgetTokens: 400,
      originalTokens: 612,
      retainedTokens: 400,
      omittedMessages: 2,
    })
    expect(JSON.parse(lines[4] ?? '')).toMatchObject({
      event: 'chat.miss.recorded',
      accountId: 'account-1',
      locationId: 'location-1',
      question: 'Did my supplier raise prices?',
      reason: 'outside-grounding',
    })
  })

  it('reports failed producer events while retaining safe operational context', () => {
    const lines: string[] = []
    const captureException = vi.fn()
    const logger = createLogger({
      service: 'operations',
      sink: (line) => lines.push(line),
      errorReporter: { captureException },
    })
    const error = new Error('Database failed')

    logger.precomputeFailed(
      { locationId: 'location-1', runId: 'run-1', durationMs: 500 },
      error,
    )
    logger.importFailed(
      {
        accountId: 'account-1',
        locationId: 'location-1',
        importId: 'import-1',
      },
      error,
    )

    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      event: 'precompute.failed',
      locationId: 'location-1',
      runId: 'run-1',
      durationMs: 500,
    })
    expect(JSON.parse(lines[1] ?? '')).toMatchObject({
      event: 'import.failed',
      accountId: 'account-1',
      importId: 'import-1',
    })
    expect(captureException).toHaveBeenCalledTimes(2)
  })
})
