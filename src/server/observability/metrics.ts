export interface PrecomputeSuccess {
  locationId: string
  runId: string
  completedAt: Date
  durationMs: number
}

export interface PrecomputeFailure {
  locationId: string
  runId: string
  failedAt: Date
}

export interface PrecomputeFailureAlert extends PrecomputeFailure {
  failureCount: number
}

export interface PrecomputeHealth {
  locationId: string
  lastSuccessfulAt: Date | null
  lastRunDurationMs: number | null
  lastFailureAt: Date | null
  failureCount: number
  isStale: boolean
}

export interface ImportSuccess {
  locationId: string
  importId: string
  completedAt: Date
  rowsImported: number
}

export interface ImportFailure {
  locationId: string
  importId: string
  failedAt: Date
}

export interface ImportHealth {
  locationId: string
  successfulImportCount: number
  failedImportCount: number
  totalImportCount: number
  successRate: number
}

export interface LlmQueryUsage {
  accountId: string
  completedAt: Date
  inputTokens: number
  outputTokens: number
  /** Millionths of the billing currency unit; integers avoid float drift. */
  costMicros: number
  currency: string
}

export interface DailyLlmSpend {
  accountId: string
  day: string
  queryCount: number
  inputTokens: number
  outputTokens: number
  costMicros: number
  currency: string
}

export interface OperationalMetricsOptions {
  onPrecomputeFailure?: (alert: PrecomputeFailureAlert) => void
}

interface StoredPrecomputeHealth {
  lastSuccessfulAt: Date | null
  lastRunDurationMs: number | null
  lastFailureAt: Date | null
  failureCount: number
}

interface StoredImportHealth {
  successfulImportCount: number
  failedImportCount: number
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}

function addSafeIntegers(left: number, right: number, field: string): number {
  const total = left + right
  if (!Number.isSafeInteger(total)) {
    throw new Error(`${field} total exceeds the safe integer range`)
  }
  return total
}

function assertNonNegativeNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`)
  }
}

function assertDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime())) throw new Error(`${field} is invalid`)
}

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value.getTime()) : null
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function healthSnapshot(
  locationId: string,
  health: StoredPrecomputeHealth,
  now: Date,
  staleAfterMs: number,
): PrecomputeHealth {
  const ageMs = health.lastSuccessfulAt
    ? Math.max(0, now.getTime() - health.lastSuccessfulAt.getTime())
    : Number.POSITIVE_INFINITY

  return {
    locationId,
    lastSuccessfulAt: cloneDate(health.lastSuccessfulAt),
    lastRunDurationMs: health.lastRunDurationMs,
    lastFailureAt: cloneDate(health.lastFailureAt),
    failureCount: health.failureCount,
    isStale: ageMs > staleAfterMs,
  }
}

/**
 * In-process operational signals until MET-02 and the persistent telemetry
 * store exist. Producers can record their typed events here without coupling
 * application code to a logging or alerting vendor.
 */
export class OperationalMetrics {
  private readonly precompute = new Map<string, StoredPrecomputeHealth>()
  private readonly imports = new Map<string, StoredImportHealth>()
  private readonly llmDailySpend = new Map<string, DailyLlmSpend>()
  private readonly onPrecomputeFailure:
    ((alert: PrecomputeFailureAlert) => void) | undefined

  constructor(options: OperationalMetricsOptions = {}) {
    this.onPrecomputeFailure = options.onPrecomputeFailure
  }

  recordPrecomputeSuccess(event: PrecomputeSuccess): void {
    assertDate(event.completedAt, 'completedAt')
    assertNonNegativeNumber(event.durationMs, 'durationMs')

    const health = this.precompute.get(event.locationId) ?? {
      lastSuccessfulAt: null,
      lastRunDurationMs: null,
      lastFailureAt: null,
      failureCount: 0,
    }
    health.lastSuccessfulAt = new Date(event.completedAt.getTime())
    health.lastRunDurationMs = event.durationMs
    this.precompute.set(event.locationId, health)
  }

  recordPrecomputeFailure(event: PrecomputeFailure): void {
    assertDate(event.failedAt, 'failedAt')

    const health = this.precompute.get(event.locationId) ?? {
      lastSuccessfulAt: null,
      lastRunDurationMs: null,
      lastFailureAt: null,
      failureCount: 0,
    }
    health.lastFailureAt = new Date(event.failedAt.getTime())
    health.failureCount += 1
    this.precompute.set(event.locationId, health)

    this.onPrecomputeFailure?.({
      ...event,
      failedAt: new Date(event.failedAt.getTime()),
      failureCount: health.failureCount,
    })
  }

  getPrecomputeHealth(
    locationId: string,
    now: Date,
    staleAfterMs: number,
  ): PrecomputeHealth {
    assertDate(now, 'now')
    assertNonNegativeNumber(staleAfterMs, 'staleAfterMs')

    const health = this.precompute.get(locationId) ?? {
      lastSuccessfulAt: null,
      lastRunDurationMs: null,
      lastFailureAt: null,
      failureCount: 0,
    }
    return healthSnapshot(locationId, health, now, staleAfterMs)
  }

  recordImportSuccess(event: ImportSuccess): void {
    assertDate(event.completedAt, 'completedAt')
    assertNonNegativeInteger(event.rowsImported, 'rowsImported')

    const health = this.imports.get(event.locationId) ?? {
      successfulImportCount: 0,
      failedImportCount: 0,
    }
    health.successfulImportCount += 1
    this.imports.set(event.locationId, health)
  }

  recordImportFailure(event: ImportFailure): void {
    assertDate(event.failedAt, 'failedAt')

    const health = this.imports.get(event.locationId) ?? {
      successfulImportCount: 0,
      failedImportCount: 0,
    }
    health.failedImportCount += 1
    this.imports.set(event.locationId, health)
  }

  getImportHealth(locationId: string): ImportHealth {
    const health = this.imports.get(locationId) ?? {
      successfulImportCount: 0,
      failedImportCount: 0,
    }
    const totalImportCount =
      health.successfulImportCount + health.failedImportCount

    return {
      locationId,
      successfulImportCount: health.successfulImportCount,
      failedImportCount: health.failedImportCount,
      totalImportCount,
      successRate:
        totalImportCount === 0
          ? 0
          : health.successfulImportCount / totalImportCount,
    }
  }

  recordLlmQuery(event: LlmQueryUsage): void {
    assertDate(event.completedAt, 'completedAt')
    assertNonNegativeInteger(event.inputTokens, 'inputTokens')
    assertNonNegativeInteger(event.outputTokens, 'outputTokens')
    assertNonNegativeInteger(event.costMicros, 'costMicros')
    if (!event.currency.trim()) throw new Error('currency must not be empty')

    const day = utcDay(event.completedAt)
    const key = `${event.accountId}:${day}`
    const existing = this.llmDailySpend.get(key)
    if (existing && existing.currency !== event.currency) {
      throw new Error('Cannot aggregate LLM spend across currencies')
    }

    this.llmDailySpend.set(key, {
      accountId: event.accountId,
      day,
      queryCount: addSafeIntegers(existing?.queryCount ?? 0, 1, 'query'),
      inputTokens: addSafeIntegers(
        existing?.inputTokens ?? 0,
        event.inputTokens,
        'input token',
      ),
      outputTokens: addSafeIntegers(
        existing?.outputTokens ?? 0,
        event.outputTokens,
        'output token',
      ),
      costMicros: addSafeIntegers(
        existing?.costMicros ?? 0,
        event.costMicros,
        'cost',
      ),
      currency: existing?.currency ?? event.currency,
    })
  }

  getLlmDailySpend(accountId: string, day: string): DailyLlmSpend | null {
    const spend = this.llmDailySpend.get(`${accountId}:${day}`)
    return spend ? { ...spend } : null
  }

  listLlmDailySpend(accountId: string): DailyLlmSpend[] {
    return [...this.llmDailySpend.values()]
      .filter((spend) => spend.accountId === accountId)
      .sort((left, right) => left.day.localeCompare(right.day))
      .map((spend) => ({ ...spend }))
  }
}
