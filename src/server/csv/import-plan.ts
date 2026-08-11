import type { CsvRows } from './parser'
import type { CanonicalField, StoredCsvMapping } from './mapping'
import {
  type ItemResolutionCandidate,
  type UnmatchedItem,
} from './item-resolution'
import {
  normalizeExactItemName,
  resolveExactItemName,
} from '@/src/server/ingestion/item-resolution'
import type { CsvImportType } from './upload-input'

type Decimal = { digits: bigint; scale: number }
type DecimalSeparator = '.' | ','

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

function exactFractionToDecimal(
  numerator: bigint,
  denominator: bigint,
): Decimal | null {
  if (denominator === 0n) return null

  const negative = numerator < 0n !== denominator < 0n
  let reducedNumerator = numerator < 0n ? -numerator : numerator
  let reducedDenominator = denominator < 0n ? -denominator : denominator
  const gcd = (left: bigint, right: bigint) => {
    let a = left
    let b = right
    while (b !== 0n) {
      const remainder = a % b
      a = b
      b = remainder
    }
    return a
  }
  const divisor = gcd(reducedNumerator, reducedDenominator)
  reducedNumerator /= divisor
  reducedDenominator /= divisor

  let twos = 0
  let fives = 0
  while (reducedDenominator % 2n === 0n) {
    reducedDenominator /= 2n
    twos += 1
  }
  while (reducedDenominator % 5n === 0n) {
    reducedDenominator /= 5n
    fives += 1
  }
  if (reducedDenominator !== 1n) return null

  const scale = Math.max(twos, fives)
  const digits =
    reducedNumerator * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives)
  return { digits: negative ? -digits : digits, scale }
}

function decimal(
  value: string,
  decimalSeparator: DecimalSeparator = '.',
): Decimal | null {
  let cleaned = value
    .trim()
    .replace(/^[$£€]/, '')
    .replace(/^\((.*)\)$/, '-$1')
  if (decimalSeparator === ',') {
    cleaned = cleaned.replaceAll('.', '').replace(',', '.')
  } else {
    cleaned = cleaned.replaceAll(',', '')
  }
  const mixed = cleaned.match(/^([+-]?\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const [, wholeText, numeratorText, denominatorText] = mixed
    const whole = BigInt(wholeText ?? '0')
    const numerator = BigInt(numeratorText ?? '0')
    const denominator = BigInt(denominatorText ?? '0')
    const sign = whole < 0n ? -1n : 1n
    const absoluteWhole = whole < 0n ? -whole : whole
    return exactFractionToDecimal(
      sign * (absoluteWhole * denominator + numerator),
      denominator,
    )
  }
  if (!DECIMAL_PATTERN.test(cleaned)) return null
  const negative = cleaned.startsWith('-')
  const unsigned = cleaned.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsigned.split('.')
  return {
    digits: BigInt(`${whole}${fraction}` || '0') * (negative ? -1n : 1n),
    scale: fraction.length,
  }
}

function decimalString(value: Decimal): string {
  if (value.digits === 0n) return '0'
  const negative = value.digits < 0n
  const digits = (negative ? -value.digits : value.digits).toString()
  if (value.scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(value.scale + 1, '0')
  return `${negative ? '-' : ''}${padded.slice(0, -value.scale)}.${padded.slice(-value.scale)}`.replace(
    /\.?([0-9]*?)0+$/,
    (_, fraction: string) => (fraction ? `.${fraction}` : ''),
  )
}

function addDecimal(left: string, right: string): string {
  const a = decimal(left)
  const b = decimal(right)
  if (!a || !b) throw new Error('Invalid decimal arithmetic input.')
  const scale = Math.max(a.scale, b.scale)
  return decimalString({
    digits:
      a.digits * 10n ** BigInt(scale - a.scale) +
      b.digits * 10n ** BigInt(scale - b.scale),
    scale,
  })
}

function multiplyDecimal(left: string, right: string): string {
  const a = decimal(left)
  const b = decimal(right)
  if (!a || !b) throw new Error('Invalid decimal arithmetic input.')
  return decimalString({
    digits: a.digits * b.digits,
    scale: a.scale + b.scale,
  })
}

function divideDecimal(left: string, right: string): string {
  const a = decimal(left)
  const b = decimal(right)
  if (!a || !b || b.digits === 0n) throw new Error('Cannot divide by zero.')
  const scale = 6
  const exponent = scale + b.scale - a.scale
  let numerator = a.digits
  let denominator = b.digits
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent)
  else denominator *= 10n ** BigInt(-exponent)
  const negative = numerator < 0n !== denominator < 0n
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator)
    quotient += 1n
  return decimalString({ digits: negative ? -quotient : quotient, scale })
}

function valueFor(
  row: string[],
  columns: string[],
  mapping: StoredCsvMapping,
  field: CanonicalField,
): string | undefined {
  const column = columns.find((name) => mapping[name] === field)
  if (!column) return undefined
  const value = row[columns.indexOf(column)]?.trim() ?? ''
  return value || undefined
}

function required(value: string | undefined, field: string, rowNumber: number) {
  if (!value)
    throw new CsvImportValidationError(
      `Row ${rowNumber}: ${field} is required.`,
    )
  return value
}

function dateValue(
  value: string | undefined,
  field: string,
  rowNumber: number,
) {
  const text = required(value, field, rowNumber)
  const date = new Date(text)
  if (Number.isNaN(date.getTime()))
    throw new CsvImportValidationError(
      `Row ${rowNumber}: ${field} is not a readable date.`,
    )
  return date
}

function numberValue(
  value: string | undefined,
  field: string,
  rowNumber: number,
  decimalSeparator: DecimalSeparator = '.',
) {
  const text = required(value, field, rowNumber)
  const parsed = decimal(text, decimalSeparator)
  if (!parsed)
    if (/[A-Za-z]{3}\s*$/.test(text))
      throw new CsvImportValidationError(
        `Row ${rowNumber}: ${field} uses a currency code; enter a numeric amount with an optional leading symbol instead.`,
      )
    else if (/%\s*$/.test(text))
      throw new CsvImportValidationError(
        `Row ${rowNumber}: ${field} uses a percentage; enter a currency amount instead.`,
      )
    else
      throw new CsvImportValidationError(
        `Row ${rowNumber}: ${field} is not a valid number.`,
      )
  return decimalString(parsed)
}

function nonNegativeNumberValue(
  value: string | undefined,
  field: string,
  rowNumber: number,
  decimalSeparator: DecimalSeparator = '.',
) {
  const normalized = numberValue(value, field, rowNumber, decimalSeparator)
  if (normalized.startsWith('-'))
    throw new CsvImportValidationError(
      `Row ${rowNumber}: ${field} cannot be negative.`,
    )
  return normalized
}

function externalIdFor(
  row: string[],
  rowNumber: number,
  value: string | undefined,
) {
  return (
    value?.trim() ||
    `csv-row-${rowNumber}-${row.map((part) => part.trim()).join('|').length}`
  )
}

export type ImportItemResolution =
  | { itemId: string }
  | {
      canonicalName: string
      displayName: string
      category: string | null
      unit: string
      shelfLifeDays: number | null
    }

export type PlannedItem =
  | { kind: 'existing'; id: string }
  | {
      kind: 'new'
      key: string
      input: Extract<ImportItemResolution, { canonicalName: string }>
    }

export type PlannedRow = {
  rowNumber: number
  rawItemName: string
  item: PlannedItem | null
  values: Record<string, string | Date | null>
}

export type ImportPlan = {
  importType: CsvImportType
  rows: PlannedRow[]
  unmatchedItems: UnmatchedItem[]
  items: ItemResolutionCandidate[]
  newItems: Array<Extract<PlannedItem, { kind: 'new' }>>
  linkedItemCount: number
}

export class CsvImportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvImportValidationError'
  }
}

function itemFor(
  rawItemName: string,
  items: readonly ItemResolutionCandidate[],
  resolutions: Readonly<Record<string, ImportItemResolution>>,
  newItems: Map<string, Extract<PlannedItem, { kind: 'new' }>>,
): { item: PlannedItem | null; unmatched: UnmatchedItem | null } {
  const automatic = resolveExactItemName(rawItemName, items)
  if (automatic.status === 'matched')
    return {
      item: { kind: 'existing', id: automatic.item.id },
      unmatched: null,
    }

  const key = normalizeExactItemName(rawItemName)
  const chosen = resolutions[key]
  if (!chosen) {
    return {
      item: null,
      unmatched: {
        rawItemName,
        normalizedItemName: automatic.normalizedItemName,
        reason: automatic.reason,
        occurrenceCount: 1,
        rowNumbers: [],
        context: [],
      },
    }
  }
  if ('itemId' in chosen) {
    if (typeof chosen.itemId !== 'string')
      throw new CsvImportValidationError(
        `Choose an existing item for “${rawItemName}”.`,
      )
    const linked = items.find((candidate) => candidate.id === chosen.itemId)
    if (!linked || linked.isActive === false)
      throw new CsvImportValidationError(
        `The selected item for “${rawItemName}” is not available.`,
      )
    return { item: { kind: 'existing', id: linked.id }, unmatched: null }
  }
  if (
    typeof chosen.canonicalName !== 'string' ||
    typeof chosen.displayName !== 'string' ||
    typeof chosen.unit !== 'string' ||
    (chosen.category !== null && typeof chosen.category !== 'string') ||
    (chosen.shelfLifeDays !== null &&
      (!Number.isSafeInteger(chosen.shelfLifeDays) || chosen.shelfLifeDays < 0))
  )
    throw new CsvImportValidationError(
      `The new item choice for “${rawItemName}” is invalid.`,
    )
  if (
    !chosen.canonicalName.trim() ||
    !chosen.displayName.trim() ||
    !chosen.unit.trim()
  )
    throw new CsvImportValidationError(
      `The new item choice for “${rawItemName}” is incomplete.`,
    )
  const newItem: Extract<PlannedItem, { kind: 'new' }> = {
    kind: 'new',
    key,
    input: chosen,
  }
  const existing = newItems.get(key)
  if (existing && JSON.stringify(existing.input) !== JSON.stringify(chosen))
    throw new CsvImportValidationError(
      `The new item choice for “${rawItemName}” changed between rows.`,
    )
  newItems.set(key, existing ?? newItem)
  return { item: newItem, unmatched: null }
}

export function buildCsvImportPlan(input: {
  csv: CsvRows
  importType: CsvImportType
  mapping: StoredCsvMapping
  items: readonly ItemResolutionCandidate[]
  resolutions?: Readonly<Record<string, ImportItemResolution>>
}): ImportPlan {
  const resolutions = input.resolutions ?? {}
  const decimalSeparator: DecimalSeparator =
    input.csv.delimiter === ';' ? ',' : '.'
  const rows: PlannedRow[] = []
  const unmatched = new Map<string, UnmatchedItem>()
  const newItems = new Map<string, Extract<PlannedItem, { kind: 'new' }>>()
  const seenFields = new Set<CanonicalField>()
  for (const field of Object.values(input.mapping)) {
    if (field !== null && seenFields.has(field))
      throw new CsvImportValidationError(
        `Map each PantryIQ field only once. “${field}” was repeated.`,
      )
    if (field !== null) seenFields.add(field)
  }

  for (const row of input.csv.rows) {
    const rawItemName =
      input.importType === 'labor'
        ? (valueFor(row.values, input.csv.columns, input.mapping, 'role') ?? '')
        : required(
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'rawItemName',
            ),
            'item name',
            row.rowNumber,
          )
    const resolution =
      input.importType === 'labor'
        ? { item: null, unmatched: null }
        : itemFor(rawItemName, input.items, resolutions, newItems)
    if (!resolution.item && input.importType !== 'labor') {
      const key = normalizeExactItemName(rawItemName) || `row-${row.rowNumber}`
      const existing = unmatched.get(key)
      if (existing) {
        existing.occurrenceCount += 1
        existing.rowNumbers.push(row.rowNumber)
        if (existing.context.length < 5) {
          existing.context.push({
            rowNumber: row.rowNumber,
            values: Object.fromEntries(
              input.csv.columns.map((column, index) => [
                column,
                row.values[index] ?? '',
              ]),
            ),
          })
        }
      } else {
        unmatched.set(key, {
          ...resolution.unmatched!,
          rowNumbers: [row.rowNumber],
          context: [
            {
              rowNumber: row.rowNumber,
              values: Object.fromEntries(
                input.csv.columns.map((column, index) => [
                  column,
                  row.values[index] ?? '',
                ]),
              ),
            },
          ],
        })
      }
      continue
    }

    if (input.importType === 'labor') {
      const scheduledHoursRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'scheduledHours',
      )
      const actualHoursRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'actualHours',
      )
      if (!scheduledHoursRaw && !actualHoursRaw)
        throw new CsvImportValidationError(
          `Row ${row.rowNumber}: map scheduled hours or actual hours.`,
        )
      rows.push({
        rowNumber: row.rowNumber,
        rawItemName,
        item: null,
        values: {
          shiftStart: dateValue(
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'shiftStart',
            ),
            'shift start',
            row.rowNumber,
          ),
          shiftEnd: valueFor(
            row.values,
            input.csv.columns,
            input.mapping,
            'shiftEnd',
          )
            ? dateValue(
                valueFor(
                  row.values,
                  input.csv.columns,
                  input.mapping,
                  'shiftEnd',
                ),
                'shift end',
                row.rowNumber,
              )
            : null,
          externalId: externalIdFor(
            row.values,
            row.rowNumber,
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'externalId',
            ),
          ),
          employeeReference:
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'employeeReference',
            ) ?? null,
          role: required(
            valueFor(row.values, input.csv.columns, input.mapping, 'role'),
            'role',
            row.rowNumber,
          ),
          scheduledHours: scheduledHoursRaw
            ? nonNegativeNumberValue(
                scheduledHoursRaw,
                'scheduled hours',
                row.rowNumber,
                decimalSeparator,
              )
            : null,
          actualHours: actualHoursRaw
            ? nonNegativeNumberValue(
                actualHoursRaw,
                'actual hours',
                row.rowNumber,
                decimalSeparator,
              )
            : null,
          laborCost: valueFor(
            row.values,
            input.csv.columns,
            input.mapping,
            'laborCost',
          )
            ? nonNegativeNumberValue(
                valueFor(
                  row.values,
                  input.csv.columns,
                  input.mapping,
                  'laborCost',
                ),
                'labor cost',
                row.rowNumber,
                decimalSeparator,
              )
            : null,
        },
      })
      continue
    }

    const qty = numberValue(
      valueFor(row.values, input.csv.columns, input.mapping, 'qty'),
      'quantity',
      row.rowNumber,
      decimalSeparator,
    )
    if (input.importType === 'transactions') {
      const totalRevenueRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'totalRevenue',
      )
      const unitPriceRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'unitPrice',
      )
      if (!totalRevenueRaw && !unitPriceRaw)
        throw new CsvImportValidationError(
          `Row ${row.rowNumber}: map total revenue or unit price.`,
        )
      const totalRevenue = totalRevenueRaw
        ? numberValue(
            totalRevenueRaw,
            'total revenue',
            row.rowNumber,
            decimalSeparator,
          )
        : multiplyDecimal(
            qty,
            numberValue(
              unitPriceRaw,
              'unit price',
              row.rowNumber,
              decimalSeparator,
            ),
          )
      const unitPrice = unitPriceRaw
        ? numberValue(
            unitPriceRaw,
            'unit price',
            row.rowNumber,
            decimalSeparator,
          )
        : divideDecimal(totalRevenue, qty)
      const totalCostRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'totalCost',
      )
      const totalCost = totalCostRaw
        ? numberValue(
            totalCostRaw,
            'total cost',
            row.rowNumber,
            decimalSeparator,
          )
        : null
      rows.push({
        rowNumber: row.rowNumber,
        rawItemName,
        item: resolution.item,
        values: {
          transactedAt: dateValue(
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'transactedAt',
            ),
            'transaction date',
            row.rowNumber,
          ),
          externalId: externalIdFor(
            row.values,
            row.rowNumber,
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'externalId',
            ),
          ),
          category:
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'category',
            ) ?? null,
          qty,
          unitPrice,
          totalRevenue,
          totalCost,
          grossMargin: totalCost
            ? addDecimal(totalRevenue, `-${totalCost}`)
            : null,
        },
      })
    } else if (input.importType === 'purchase_orders') {
      const totalCostRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'totalCost',
      )
      const unitCostRaw = valueFor(
        row.values,
        input.csv.columns,
        input.mapping,
        'unitCost',
      )
      if (!totalCostRaw && !unitCostRaw)
        throw new CsvImportValidationError(
          `Row ${row.rowNumber}: map total cost or unit cost.`,
        )
      const unitCost = unitCostRaw
        ? numberValue(unitCostRaw, 'unit cost', row.rowNumber, decimalSeparator)
        : divideDecimal(
            numberValue(
              totalCostRaw,
              'total cost',
              row.rowNumber,
              decimalSeparator,
            ),
            qty,
          )
      const totalCost = totalCostRaw
        ? numberValue(
            totalCostRaw,
            'total cost',
            row.rowNumber,
            decimalSeparator,
          )
        : multiplyDecimal(qty, unitCost)
      rows.push({
        rowNumber: row.rowNumber,
        rawItemName,
        item: resolution.item,
        values: {
          orderedAt: dateValue(
            valueFor(row.values, input.csv.columns, input.mapping, 'orderedAt'),
            'order date',
            row.rowNumber,
          ),
          receivedAt: valueFor(
            row.values,
            input.csv.columns,
            input.mapping,
            'receivedAt',
          )
            ? dateValue(
                valueFor(
                  row.values,
                  input.csv.columns,
                  input.mapping,
                  'receivedAt',
                ),
                'received date',
                row.rowNumber,
              )
            : null,
          externalId: externalIdFor(
            row.values,
            row.rowNumber,
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'externalId',
            ),
          ),
          supplierName:
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'supplierName',
            ) ?? null,
          qty,
          unitCost,
          totalCost,
        },
      })
    } else {
      rows.push({
        rowNumber: row.rowNumber,
        rawItemName,
        item: resolution.item,
        values: {
          countedAt: dateValue(
            valueFor(row.values, input.csv.columns, input.mapping, 'countedAt'),
            'count date',
            row.rowNumber,
          ),
          qty,
          category:
            valueFor(
              row.values,
              input.csv.columns,
              input.mapping,
              'category',
            ) ?? null,
          unit:
            valueFor(row.values, input.csv.columns, input.mapping, 'unit') ??
            null,
          shelfLifeDays: valueFor(
            row.values,
            input.csv.columns,
            input.mapping,
            'shelfLifeDays',
          )
            ? numberValue(
                valueFor(
                  row.values,
                  input.csv.columns,
                  input.mapping,
                  'shelfLifeDays',
                ),
                'shelf life',
                row.rowNumber,
                decimalSeparator,
              )
            : null,
        },
      })
    }
  }

  return {
    importType: input.importType,
    rows,
    unmatchedItems: [...unmatched.values()],
    items: [...input.items],
    newItems: [...newItems.values()],
    linkedItemCount: rows.filter((row) => row.item?.kind === 'existing').length,
  }
}
