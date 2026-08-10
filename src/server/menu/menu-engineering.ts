const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const THRESHOLD_SCALE = 6

type Decimal = { coefficient: bigint; scale: number }

function parseDecimal(value: string): Decimal | null {
  if (!DECIMAL_PATTERN.test(value)) return null

  const negative = value.startsWith('-')
  const unsigned = value.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsigned.split('.')
  const coefficient = BigInt(`${whole || '0'}${fraction}`)
  return normalize({
    coefficient: negative ? -coefficient : coefficient,
    scale: fraction.length,
  })
}

function normalize(value: Decimal): Decimal {
  if (value.coefficient === 0n) return { coefficient: 0n, scale: 0 }

  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function powerOfTen(scale: number) {
  return 10n ** BigInt(scale)
}

function decimalString(value: Decimal) {
  const normalized = normalize(value)
  if (normalized.coefficient === 0n) return '0'

  const negative = normalized.coefficient < 0n
  const digits = (
    negative ? -normalized.coefficient : normalized.coefficient
  ).toString()
  if (normalized.scale === 0) return `${negative ? '-' : ''}${digits}`

  const padded = digits.padStart(normalized.scale + 1, '0')
  const splitAt = padded.length - normalized.scale
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
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator)
    quotient += 1n

  return normalize({ coefficient: negative ? -quotient : quotient, scale })
}

function compare(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale)
  const leftCoefficient = left.coefficient * powerOfTen(scale - left.scale)
  const rightCoefficient = right.coefficient * powerOfTen(scale - right.scale)
  return leftCoefficient < rightCoefficient
    ? -1
    : leftCoefficient > rightCoefficient
      ? 1
      : 0
}

function decimal(value: string, field: string) {
  const parsed = parseDecimal(value)
  if (!parsed) throw new Error(`${field} must be a decimal string.`)
  return parsed
}

export const MIN_MENU_ENGINEERING_WEEKS = 4

export type MenuEngineeringItem = {
  menuItemId: string
  name: string
  marginPerItem: string | null
}

export type MenuEngineeringSale = {
  menuItemId: string
  transactedAt: string
  qty: string
}

export type MenuEngineeringQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'

export type MenuEngineeringRow = {
  menuItemId: string
  name: string
  unitsSold: string
  marginPerItem: string
  contributionMargin: string
  salesWeeks: number
  popularity: 'high' | 'low'
  profitability: 'high' | 'low'
  quadrant: MenuEngineeringQuadrant
  quadrantLabel: string
}

export type MenuEngineeringExclusion = {
  menuItemId: string
  name: string
  reason: string
}

export type MenuEngineeringResult = {
  status: 'calculated' | 'insufficient-data'
  minimumHistoryWeeks: number
  observedWeeks: number
  popularityThreshold: string | null
  marginThreshold: string | null
  rows: MenuEngineeringRow[]
  excluded: MenuEngineeringExclusion[]
}

type BusinessDateParts = { year: number; month: number; day: number }

function businessDate(
  transactedAt: string,
  timezone: string,
  businessDayBoundary: string,
): BusinessDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(transactedAt))
      .map((part) => [part.type, part.value]),
  )
  const [boundaryHour = '0', boundaryMinute = '0'] = businessDayBoundary
    .slice(0, 5)
    .split(':')
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute)
  const boundaryMinutes = Number(boundaryHour) * 60 + Number(boundaryMinute)
  const localDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  )
  if (currentMinutes < boundaryMinutes)
    localDate.setUTCDate(localDate.getUTCDate() - 1)

  return {
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth() + 1,
    day: localDate.getUTCDate(),
  }
}

/**
 * Returns the Monday that begins the restaurant's business week. The
 * transaction is converted to the location's wall clock before the
 * business-day boundary is applied; a calendar day is not a restaurant day.
 */
export function businessWeekKey(
  transactedAt: string,
  timezone: string,
  businessDayBoundary: string,
): string {
  const date = businessDate(transactedAt, timezone, businessDayBoundary)
  const localDate = new Date(Date.UTC(date.year, date.month - 1, date.day))
  const day = localDate.getUTCDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  localDate.setUTCDate(localDate.getUTCDate() - daysFromMonday)
  return localDate.toISOString().slice(0, 10)
}

function quadrantFor(
  popularity: 'high' | 'low',
  profitability: 'high' | 'low',
) {
  if (popularity === 'high' && profitability === 'high')
    return {
      quadrant: 'star' as const,
      quadrantLabel: 'Star: popular and profitable',
    }
  if (popularity === 'high')
    return {
      quadrant: 'plowhorse' as const,
      quadrantLabel: 'Plowhorse: popular, lower margin',
    }
  if (profitability === 'high')
    return {
      quadrant: 'puzzle' as const,
      quadrantLabel: 'Puzzle: profitable, less popular',
    }
  return {
    quadrant: 'dog' as const,
    quadrantLabel: 'Dog: less popular and lower margin',
  }
}

/**
 * Builds the menu engineering matrix from already-normalized sales and
 * recipe-derived plate margins. Averages are calculated with integer decimal
 * arithmetic, and every item needs four distinct business weeks by default.
 */
export function buildMenuEngineeringMatrix(
  items: readonly MenuEngineeringItem[],
  sales: readonly MenuEngineeringSale[],
  options: {
    timezone: string
    businessDayBoundary: string
    minimumHistoryWeeks?: number
  },
): MenuEngineeringResult {
  const minimumHistoryWeeks =
    options.minimumHistoryWeeks ?? MIN_MENU_ENGINEERING_WEEKS
  if (!Number.isInteger(minimumHistoryWeeks) || minimumHistoryWeeks < 1)
    throw new Error('minimumHistoryWeeks must be a positive integer.')

  const salesByItem = new Map<string, MenuEngineeringSale[]>()
  for (const sale of sales) {
    const current = salesByItem.get(sale.menuItemId) ?? []
    current.push(sale)
    salesByItem.set(sale.menuItemId, current)
  }

  const excluded: MenuEngineeringExclusion[] = []
  const candidates: Array<{
    item: MenuEngineeringItem
    unitsSold: Decimal
    marginPerItem: Decimal
    salesWeeks: number
  }> = []
  let observedWeeks = 0

  for (const item of items) {
    const itemSales = salesByItem.get(item.menuItemId) ?? []
    const weeks = new Set(
      itemSales.map((sale) =>
        businessWeekKey(
          sale.transactedAt,
          options.timezone,
          options.businessDayBoundary,
        ),
      ),
    )
    observedWeeks = Math.max(observedWeeks, weeks.size)
    if (weeks.size < minimumHistoryWeeks) {
      excluded.push({
        menuItemId: item.menuItemId,
        name: item.name,
        reason: `Only ${weeks.size} complete business week${weeks.size === 1 ? '' : 's'} of sales; at least ${minimumHistoryWeeks} are needed.`,
      })
      continue
    }
    if (item.marginPerItem === null) {
      excluded.push({
        menuItemId: item.menuItemId,
        name: item.name,
        reason: 'A complete recipe-derived plate margin is not available.',
      })
      continue
    }

    const unitsSold = itemSales.reduce(
      (total, sale) => add(total, decimal(sale.qty, 'sale quantity')),
      { coefficient: 0n, scale: 0 },
    )
    candidates.push({
      item,
      unitsSold,
      marginPerItem: decimal(item.marginPerItem, 'plate margin'),
      salesWeeks: weeks.size,
    })
  }

  if (candidates.length === 0) {
    return {
      status: 'insufficient-data',
      minimumHistoryWeeks,
      observedWeeks,
      popularityThreshold: null,
      marginThreshold: null,
      rows: [],
      excluded,
    }
  }

  const popularityTotal = candidates.reduce(
    (total, candidate) => add(total, candidate.unitsSold),
    { coefficient: 0n, scale: 0 },
  )
  const marginTotal = candidates.reduce(
    (total, candidate) => add(total, candidate.marginPerItem),
    { coefficient: 0n, scale: 0 },
  )
  const count = { coefficient: BigInt(candidates.length), scale: 0 }
  const popularityThreshold = divide(popularityTotal, count, THRESHOLD_SCALE)
  const marginThreshold = divide(marginTotal, count, THRESHOLD_SCALE)

  const rows = candidates
    .map(({ item, unitsSold, marginPerItem, salesWeeks }) => {
      const popularity: 'high' | 'low' =
        compare(unitsSold, popularityThreshold) >= 0 ? 'high' : 'low'
      const profitability: 'high' | 'low' =
        compare(marginPerItem, marginThreshold) >= 0 ? 'high' : 'low'
      const quadrant = quadrantFor(popularity, profitability)
      return {
        menuItemId: item.menuItemId,
        name: item.name,
        unitsSold: decimalString(unitsSold),
        marginPerItem: decimalString(marginPerItem),
        contributionMargin: decimalString(multiply(unitsSold, marginPerItem)),
        salesWeeks,
        popularity,
        profitability,
        ...quadrant,
      }
    })
    .sort((left, right) => {
      const marginComparison = compare(
        decimal(right.contributionMargin, 'contribution margin'),
        decimal(left.contributionMargin, 'contribution margin'),
      )
      return marginComparison || left.name.localeCompare(right.name)
    })

  return {
    status: 'calculated',
    minimumHistoryWeeks,
    observedWeeks,
    popularityThreshold: decimalString(popularityThreshold),
    marginThreshold: decimalString(marginThreshold),
    rows,
    excluded,
  }
}
