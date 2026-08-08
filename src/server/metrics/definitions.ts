/**
 * Deterministic metric primitives. PostgreSQL numeric values arrive as
 * strings, so these functions deliberately accept strings and never coerce
 * through JavaScript Number. Ratios are rounded to six decimal places with
 * integer arithmetic; the rounding is part of the returned evidence.
 */

export type MetricResult<T> =
  | {
      status: 'calculated'
      value: T
      inputs: Record<string, string>
      units: Record<string, string>
      rounding?: string
    }
  | {
      status: 'cannot-calculate'
      reason: string
      inputs: Record<string, string>
      units: Record<string, string>
    }

type CannotCalculate = Extract<
  MetricResult<never>,
  { status: 'cannot-calculate' }
>

type Decimal = {
  coefficient: bigint
  scale: number
}

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const RATIO_SCALE = 6

function powerOfTen(scale: number) {
  return 10n ** BigInt(scale)
}

function normalize(decimal: Decimal): Decimal {
  if (decimal.coefficient === 0n) return { coefficient: 0n, scale: 0 }

  let coefficient = decimal.coefficient
  let scale = decimal.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function parseDecimal(value: string): Decimal | undefined {
  if (!DECIMAL_PATTERN.test(value)) return undefined

  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [integerPart = '', fractionalPart = ''] = unsigned.split('.')
  const digits = `${integerPart || '0'}${fractionalPart}`.replace(
    /^0+(?=\d)/,
    '',
  )
  const coefficient = BigInt(digits || '0') * (negative ? -1n : 1n)

  return normalize({ coefficient, scale: fractionalPart.length })
}

function decimalToString(decimal: Decimal) {
  const normalized = normalize(decimal)
  if (normalized.coefficient === 0n) return '0'

  const negative = normalized.coefficient < 0n
  const digits = (
    negative ? -normalized.coefficient : normalized.coefficient
  ).toString()
  const { scale } = normalized

  if (scale === 0) return `${negative ? '-' : ''}${digits}`

  const padded = digits.padStart(scale + 1, '0')
  const splitAt = padded.length - scale
  return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`
}

function add(left: Decimal, right: Decimal): Decimal {
  const scale = Math.max(left.scale, right.scale)
  return normalize({
    coefficient:
      left.coefficient * powerOfTen(scale - left.scale) +
      right.coefficient * powerOfTen(scale - right.scale),
    scale,
  })
}

function subtract(left: Decimal, right: Decimal) {
  return add(left, { coefficient: -right.coefficient, scale: right.scale })
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  })
}

function divide(left: Decimal, right: Decimal, scale: number): Decimal {
  if (right.coefficient === 0n) throw new Error('Cannot divide by zero.')

  const exponent = scale + right.scale - left.scale
  let numerator = left.coefficient
  let denominator = right.coefficient
  if (exponent >= 0) numerator *= powerOfTen(exponent)
  else denominator *= powerOfTen(-exponent)

  const negative = numerator < 0n !== denominator < 0n
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  const remainder = absoluteNumerator % absoluteDenominator

  if (remainder * 2n >= absoluteDenominator) quotient += 1n
  return normalize({ coefficient: negative ? -quotient : quotient, scale })
}

function inputValues(values: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  )
}

function missingInput(
  values: Record<string, string | undefined>,
  units: Record<string, string>,
  name: string,
): CannotCalculate {
  return {
    status: 'cannot-calculate',
    reason: `cannot calculate, no ${name}`,
    inputs: inputValues(values),
    units,
  }
}

function invalidInput(
  values: Record<string, string | undefined>,
  units: Record<string, string>,
  name: string,
): CannotCalculate {
  return {
    status: 'cannot-calculate',
    reason: `cannot calculate, ${name} is not a valid decimal`,
    inputs: inputValues(values),
    units,
  }
}

function parseMetricInputs(
  values: Record<string, string | undefined>,
  units: Record<string, string>,
): CannotCalculate | { decimals: Decimal[] } {
  const entries = Object.entries(values)
  for (const [name, value] of entries) {
    if (value === undefined || value === '')
      return missingInput(values, units, name)
    const decimal = parseDecimal(value)
    if (!decimal) return invalidInput(values, units, name)
  }

  return {
    decimals: entries.map(
      ([, value]) => parseDecimal(value as string) as Decimal,
    ),
  }
}

export function sellThroughRate(input: {
  qtySold?: string
  qtyOrdered?: string
  unit?: string
}): MetricResult<string> {
  const values = {
    qtySold: input.qtySold,
    qtyOrdered: input.qtyOrdered,
    unit: input.unit,
  }
  const units = {
    qtySold: input.unit ?? 'units',
    qtyOrdered: input.unit ?? 'units',
    value: '%',
  }
  if (input.qtySold === undefined)
    return missingInput(values, units, 'quantity sold')
  if (input.qtyOrdered === undefined)
    return missingInput(values, units, 'quantity ordered')

  const parsed = parseMetricInputs(
    { qtySold: input.qtySold, qtyOrdered: input.qtyOrdered },
    units,
  )
  if ('status' in parsed) return parsed
  const [sold, ordered] = parsed.decimals
  if (!sold || !ordered) return invalidInput(values, units, 'quantity')
  if (ordered.coefficient === 0n)
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, quantity ordered is zero',
      inputs: inputValues(values),
      units,
    }

  return {
    status: 'calculated',
    value: decimalToString(
      divide(
        multiply(sold, { coefficient: 100n, scale: 0 }),
        ordered,
        RATIO_SCALE,
      ),
    ),
    inputs: inputValues(values),
    units,
    rounding: `ratio rounded to ${RATIO_SCALE} decimal places using half-up integer arithmetic`,
  }
}

export function spoilageEstimate(input: {
  qtyOrdered?: string
  qtySold?: string
  qtyOnHand?: string
  unit?: string
}): MetricResult<string> {
  const values = {
    qtyOrdered: input.qtyOrdered,
    qtySold: input.qtySold,
    qtyOnHand: input.qtyOnHand,
    unit: input.unit,
  }
  const units = {
    qtyOrdered: input.unit ?? 'units',
    qtySold: input.unit ?? 'units',
    qtyOnHand: input.unit ?? 'units',
    value: input.unit ?? 'units',
  }
  for (const [name, value] of [
    ['quantity ordered', input.qtyOrdered],
    ['quantity sold', input.qtySold],
    ['quantity on hand', input.qtyOnHand],
  ] as const) {
    if (value === undefined) return missingInput(values, units, name)
  }
  const parsed = parseMetricInputs(
    {
      qtyOrdered: input.qtyOrdered,
      qtySold: input.qtySold,
      qtyOnHand: input.qtyOnHand,
    },
    units,
  )
  if ('status' in parsed) return parsed
  const [ordered, sold, onHand] = parsed.decimals
  if (!ordered || !sold || !onHand)
    return invalidInput(values, units, 'quantity')

  return {
    status: 'calculated',
    value: decimalToString(subtract(subtract(ordered, sold), onHand)),
    inputs: inputValues(values),
    units,
  }
}

export function spoilageRisk(input: {
  qtyOnHand?: string
  unitCost?: string
  unit?: string
  currency?: string
}): MetricResult<string> {
  const values = {
    qtyOnHand: input.qtyOnHand,
    unitCost: input.unitCost,
    unit: input.unit,
    currency: input.currency,
  }
  const units = {
    qtyOnHand: input.unit ?? 'units',
    unitCost: `${input.currency ?? 'currency'}/${input.unit ?? 'unit'}`,
    value: input.currency ?? 'currency',
  }
  if (input.qtyOnHand === undefined)
    return missingInput(values, units, 'quantity on hand')
  if (input.unitCost === undefined)
    return missingInput(values, units, 'unit cost')

  const parsed = parseMetricInputs(
    { qtyOnHand: input.qtyOnHand, unitCost: input.unitCost },
    units,
  )
  if ('status' in parsed) return parsed
  const [onHand, unitCost] = parsed.decimals
  if (!onHand || !unitCost) return invalidInput(values, units, 'cost input')

  return {
    status: 'calculated',
    value: decimalToString(multiply(onHand, unitCost)),
    inputs: inputValues(values),
    units,
  }
}

export function margin(input: {
  revenue?: string
  qtySold?: string
  unitCost?: string
  unit?: string
  currency?: string
}): MetricResult<string> {
  const values = {
    revenue: input.revenue,
    qtySold: input.qtySold,
    unitCost: input.unitCost,
    unit: input.unit,
    currency: input.currency,
  }
  const units = {
    revenue: input.currency ?? 'currency',
    qtySold: input.unit ?? 'units',
    unitCost: `${input.currency ?? 'currency'}/${input.unit ?? 'unit'}`,
    value: input.currency ?? 'currency',
  }
  if (input.revenue === undefined) return missingInput(values, units, 'revenue')
  if (input.qtySold === undefined)
    return missingInput(values, units, 'quantity sold')
  if (input.unitCost === undefined)
    return missingInput(values, units, 'unit cost')

  const parsed = parseMetricInputs(
    {
      revenue: input.revenue,
      qtySold: input.qtySold,
      unitCost: input.unitCost,
    },
    units,
  )
  if ('status' in parsed) return parsed
  const [revenue, qtySold, unitCost] = parsed.decimals
  if (!revenue || !qtySold || !unitCost)
    return invalidInput(values, units, 'margin input')

  return {
    status: 'calculated',
    value: decimalToString(subtract(revenue, multiply(qtySold, unitCost))),
    inputs: inputValues(values),
    units,
  }
}

export function variance(input: {
  qtyOrdered?: string
  qtySold?: string
  qtyOnHand?: string
  unit?: string
}): MetricResult<string> {
  const values = {
    qtyOrdered: input.qtyOrdered,
    qtySold: input.qtySold,
    qtyOnHand: input.qtyOnHand,
    unit: input.unit,
  }
  const units = {
    qtyOrdered: input.unit ?? 'units',
    qtySold: input.unit ?? 'units',
    qtyOnHand: input.unit ?? 'units',
    value: '%',
  }
  for (const [name, value] of [
    ['quantity ordered', input.qtyOrdered],
    ['quantity sold', input.qtySold],
    ['quantity on hand', input.qtyOnHand],
  ] as const) {
    if (value === undefined) return missingInput(values, units, name)
  }
  const parsed = parseMetricInputs(
    {
      qtyOrdered: input.qtyOrdered,
      qtySold: input.qtySold,
      qtyOnHand: input.qtyOnHand,
    },
    units,
  )
  if ('status' in parsed) return parsed
  const [ordered, sold, onHand] = parsed.decimals
  if (!ordered || !sold || !onHand)
    return invalidInput(values, units, 'quantity')
  if (ordered.coefficient === 0n)
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, quantity ordered is zero',
      inputs: inputValues(values),
      units,
    }

  return {
    status: 'calculated',
    value: decimalToString(
      divide(
        multiply(subtract(subtract(ordered, sold), onHand), {
          coefficient: 100n,
          scale: 0,
        }),
        ordered,
        RATIO_SCALE,
      ),
    ),
    inputs: inputValues(values),
    units,
    rounding: `ratio rounded to ${RATIO_SCALE} decimal places using half-up integer arithmetic`,
  }
}

function serializeTimestamp(timestamp: Date | string) {
  if (timestamp instanceof Date) {
    return Number.isNaN(timestamp.getTime())
      ? timestamp.toString()
      : timestamp.toISOString()
  }
  return timestamp
}

function padded(value: number) {
  return value.toString().padStart(2, '0')
}

function localDateParts(timestamp: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

export function businessDayBucket(input: {
  timestamp: Date | string
  timezone: string
  boundary?: string
}): MetricResult<string> {
  const timestampValue = serializeTimestamp(input.timestamp)
  const values = {
    timestamp: timestampValue,
    timezone: input.timezone,
    boundary: input.boundary ?? '04:00:00',
  }
  const units = { value: 'local business date' }
  const timestamp = new Date(input.timestamp)
  if (Number.isNaN(timestamp.getTime()))
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, timestamp is invalid',
      inputs: values,
      units,
    }

  const boundaryMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(values.boundary)
  const boundaryHour = boundaryMatch ? Number(boundaryMatch[1]) : NaN
  const boundaryMinute = boundaryMatch ? Number(boundaryMatch[2]) : NaN
  const boundarySecond = boundaryMatch?.[3] ? Number(boundaryMatch[3]) : 0
  if (
    !boundaryMatch ||
    boundaryHour > 23 ||
    boundaryMinute > 59 ||
    boundarySecond > 59
  )
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, business-day boundary is invalid',
      inputs: values,
      units,
    }

  let local: ReturnType<typeof localDateParts>
  try {
    local = localDateParts(timestamp, input.timezone)
  } catch {
    return {
      status: 'cannot-calculate',
      reason: 'cannot calculate, timezone is invalid',
      inputs: values,
      units,
    }
  }

  const beforeBoundary =
    local.hour * 3600 + local.minute * 60 + local.second <
    boundaryHour * 3600 + boundaryMinute * 60 + boundarySecond
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day))
  if (beforeBoundary) date.setUTCDate(date.getUTCDate() - 1)
  const value = `${date.getUTCFullYear()}-${padded(date.getUTCMonth() + 1)}-${padded(date.getUTCDate())}`

  return { status: 'calculated', value, inputs: values, units }
}
