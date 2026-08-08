export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log fields intentionally accept scalar values only. Identifiers, counts,
 * durations, and statuses are useful in a log; arbitrary imported records are
 * not. The runtime sanitizer remains defensive for JavaScript callers.
 */
export type SafeLogValue = string | number | boolean | null | undefined
export type SafeLogFields = Record<string, SafeLogValue>

export interface ErrorReporter {
  captureException(error: Error, context: SafeLogFields): void
}

export interface LoggerOptions {
  service: string
  sink?: (line: string, level: LogLevel) => void
  errorReporter?: ErrorReporter
  now?: () => Date
}

export interface StructuredLogEvent {
  timestamp: string
  level: LogLevel
  service: string
  message: string
  [key: string]: SafeLogValue
}

const SENSITIVE_KEY =
  /(?:password|passphrase|secret|token|api[-_]?key|authorization|cookie|credential|session)/i
const IMPORTED_ROW_KEY =
  /(?:^|[-_])(raw|full|imported|csv)?[-_]?(row|rows|record|records|payload|data)(?:$|[-_])/i
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const QUERY_SECRET =
  /([?&](?:token|password|secret|api[-_]?key|access_token|refresh_token)=)[^&\s]+/gi
const REDACTED = '[REDACTED]'

function redactText(value: string): string {
  return value
    .replace(BEARER_TOKEN, `Bearer ${REDACTED}`)
    .replace(QUERY_SECRET, `$1${REDACTED}`)
}

function redactRuntimeValue(key: string, value: unknown): SafeLogValue {
  if (SENSITIVE_KEY.test(key)) return REDACTED
  if (IMPORTED_ROW_KEY.test(key)) return '[REDACTED_IMPORTED_ROW]'

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'string') return redactText(value)
  return '[REDACTED_NON_SCALAR]'
}

function safeFields(fields: Record<string, unknown>): SafeLogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      redactRuntimeValue(key, value),
    ]),
  )
}

function serializeError(error: Error): SafeLogFields {
  return {
    errorName: redactText(error.name),
    errorMessage: redactText(error.message),
    ...(error.stack ? { errorStack: redactText(error.stack) } : {}),
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options)
}

export class Logger {
  private readonly sink: (line: string, level: LogLevel) => void
  private readonly errorReporter: ErrorReporter | undefined
  private readonly now: () => Date
  private readonly service: string

  constructor(options: LoggerOptions) {
    this.service = options.service
    this.sink =
      options.sink ??
      ((line, level) => {
        if (level === 'error') console.error(line)
        else if (level === 'warn') console.warn(line)
        else console.log(line)
      })
    this.errorReporter = options.errorReporter
    this.now = options.now ?? (() => new Date())
  }

  debug(message: string, fields: SafeLogFields = {}): void {
    this.write('debug', message, fields)
  }

  info(message: string, fields: SafeLogFields = {}): void {
    this.write('info', message, fields)
  }

  warn(message: string, fields: SafeLogFields = {}): void {
    this.write('warn', message, fields)
  }

  error(message: string, error?: Error, fields: SafeLogFields = {}): void {
    const context = {
      ...fields,
      ...(error ? serializeError(error) : {}),
    }
    this.write('error', message, context)

    if (error && this.errorReporter) {
      this.errorReporter.captureException(error, safeFields(context))
    }
  }

  private write(level: LogLevel, message: string, fields: SafeLogFields): void {
    const event: StructuredLogEvent = {
      timestamp: this.now().toISOString(),
      level,
      service: this.service,
      message: redactText(message),
      ...safeFields(fields),
    }
    this.sink(JSON.stringify(event), level)
  }
}
