export type StandardUnit = 'each' | 'case' | 'g' | 'kg' | 'oz' | 'lb'

type Fraction = {
  numerator: bigint
  denominator: bigint
}

const unitAliases: Record<string, StandardUnit> = {
  case: 'case',
  cases: 'case',
  each: 'each',
  ea: 'each',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
}

const unitDimensions: Record<StandardUnit, 'count' | 'mass'> = {
  case: 'count',
  each: 'count',
  g: 'mass',
  kg: 'mass',
  lb: 'mass',
  oz: 'mass',
}

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnitConversionError'
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let left = a < 0n ? -a : a
  let right = b < 0n ? -b : b
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) {
    throw new UnitConversionError('A unit conversion cannot divide by zero.')
  }

  const sign = denominator < 0n ? -1n : 1n
  const divisor = gcd(numerator, denominator)
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  }
}

function parseDecimal(value: string, field: string): Fraction {
  const normalized = value.trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    throw new UnitConversionError(
      `${field} must be a non-negative decimal string.`,
    )
  }

  const [whole, decimal = ''] = normalized.split('.')
  const scale = 10n ** BigInt(decimal.length)
  return fraction(BigInt(`${whole}${decimal}`), scale)
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  )
}

function divide(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  )
}

function fractionToDecimal(value: Fraction): string {
  if (value.numerator < 0n) {
    throw new UnitConversionError('Unit quantities cannot be negative.')
  }

  let denominator = value.denominator
  let twos = 0
  let fives = 0
  while (denominator % 2n === 0n) {
    denominator /= 2n
    twos += 1
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n
    fives += 1
  }
  if (denominator !== 1n) {
    throw new UnitConversionError(
      'This unit conversion produces a repeating decimal and cannot be represented exactly.',
    )
  }

  const scale = Math.max(twos, fives)
  const scaledNumerator =
    value.numerator * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives)
  const divisor = 10n ** BigInt(scale)
  const whole = scaledNumerator / divisor
  const remainder = scaledNumerator % divisor
  if (remainder === 0n) return whole.toString()

  const decimal = remainder.toString().padStart(scale, '0').replace(/0+$/, '')
  return `${whole}.${decimal}`
}

function baseQuantity(unit: StandardUnit, casePackSize?: string): Fraction {
  switch (unit) {
    case 'each':
      return fraction(1n)
    case 'case': {
      if (!casePackSize) {
        throw new UnitConversionError(
          'case conversions require the item pack size in eaches.',
        )
      }
      const packSize = parseDecimal(casePackSize, 'case pack size')
      if (packSize.denominator !== 1n || packSize.numerator < 1n) {
        throw new UnitConversionError(
          'case pack size must be a positive whole-number string.',
        )
      }
      return packSize
    }
    case 'g':
      return fraction(1n)
    case 'kg':
      return fraction(1000n)
    case 'oz':
      return parseDecimal('28.349523125', 'ounce conversion')
    case 'lb':
      return parseDecimal('453.59237', 'pound conversion')
  }
}

export function normalizeUnit(value: string): StandardUnit {
  const unit = unitAliases[value.trim().toLowerCase()]
  if (!unit) throw new UnitConversionError(`Unsupported unit: ${value}.`)
  return unit
}

export function areUnitsConvertible(fromUnit: string, toUnit: string) {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  return unitDimensions[from] === unitDimensions[to]
}

export function convertQuantity(
  quantity: string,
  fromUnit: string,
  toUnit: string,
  options: { casePackSize?: string } = {},
): string {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (unitDimensions[from] !== unitDimensions[to]) {
    throw new UnitConversionError(
      `${from} and ${to} measure different kinds of quantity.`,
    )
  }

  const input = parseDecimal(quantity, 'quantity')
  const factor = divide(
    baseQuantity(from, options.casePackSize),
    baseQuantity(to, options.casePackSize),
  )
  return fractionToDecimal(multiply(input, factor))
}
