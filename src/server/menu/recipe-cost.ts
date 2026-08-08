import { convertQuantity, UnitConversionError } from './unit-conversion'

export type RecipeCostLine = {
  ingredientItemId: string
  label: string
  cost: string | null
  status: 'ready' | 'missing-cost' | 'unit-mismatch'
  detail: string
}

export type RecipeCost = {
  status: 'empty' | 'partial' | 'complete'
  totalCost: string | null
  lines: RecipeCostLine[]
  missingCostItemIds: string[]
}

export type RecipePlateCostInput = {
  batchCost: string | null
  outputQuantity: string
  outputUnit: string
  yieldFactor: string
  wasteFactor: string
  menuPrice: string | null
}

export type RecipePlateCost = {
  status: RecipeCost['status']
  effectiveOutputQuantity: string | null
  costPerOutput: string | null
  menuPrice: string | null
  plateMargin: string | null
  foodCostPercentage: string | null
  reason: string | null
}

export type RecipeCostIngredient = {
  ingredientItemId: string
  label: string
  quantity: string
  unit: string
  itemUnit: string
  unitCost: string | null
  casePackSize?: string
}

type DecimalParts = { digits: bigint; scale: number }

function decimalParts(value: string): DecimalParts {
  const [whole, fraction = ''] = value.split('.')
  return { digits: BigInt(`${whole}${fraction}`), scale: fraction.length }
}

function decimalString(parts: DecimalParts): string {
  if (parts.digits === 0n) return '0'
  const negative = parts.digits < 0n
  const digits = (negative ? -parts.digits : parts.digits).toString()
  const raw = digits.padStart(parts.scale + 1, '0')
  if (parts.scale === 0) return `${negative ? '-' : ''}${raw}`
  return `${negative ? '-' : ''}${raw.slice(0, -parts.scale)}.${raw.slice(-parts.scale)}`.replace(
    /\.?(\d*?)0+$/,
    (_, fraction: string) => (fraction ? `.${fraction}` : ''),
  )
}

function addDecimals(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  const scale = Math.max(a.scale, b.scale)
  const leftDigits = a.digits * 10n ** BigInt(scale - a.scale)
  const rightDigits = b.digits * 10n ** BigInt(scale - b.scale)
  return decimalString({ digits: leftDigits + rightDigits, scale })
}

function multiplyDecimals(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  return decimalString({
    digits: a.digits * b.digits,
    scale: a.scale + b.scale,
  })
}

function divideDecimals(left: string, right: string, scale = 6): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  if (b.digits === 0n) throw new Error('Cannot divide by zero.')
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

function subtractDecimals(left: string, right: string): string {
  const a = decimalParts(left)
  const b = decimalParts(right)
  const scale = Math.max(a.scale, b.scale)
  return decimalString({
    digits:
      a.digits * 10n ** BigInt(scale - a.scale) -
      b.digits * 10n ** BigInt(scale - b.scale),
    scale,
  })
}

/**
 * Projects a recipe batch onto one output unit. Division is rounded half-up
 * to six decimal places and recorded by callers as part of the evidence.
 */
export function calculateRecipePlateCost(
  input: RecipePlateCostInput,
): RecipePlateCost {
  if (input.batchCost === null) {
    return {
      status: input.outputQuantity ? 'partial' : 'empty',
      effectiveOutputQuantity: null,
      costPerOutput: null,
      menuPrice: input.menuPrice,
      plateMargin: null,
      foodCostPercentage: null,
      reason:
        'A complete batch cost is required before plate cost can be calculated.',
    }
  }

  const effectiveOutputQuantity = multiplyDecimals(
    multiplyDecimals(input.outputQuantity, input.yieldFactor),
    subtractDecimals('1', input.wasteFactor),
  )
  if (effectiveOutputQuantity === '0') {
    return {
      status: 'partial',
      effectiveOutputQuantity: null,
      costPerOutput: null,
      menuPrice: input.menuPrice,
      plateMargin: null,
      foodCostPercentage: null,
      reason: 'Effective output quantity must be greater than zero.',
    }
  }

  const costPerOutput = divideDecimals(input.batchCost, effectiveOutputQuantity)
  const plateMargin =
    input.menuPrice === null
      ? null
      : subtractDecimals(input.menuPrice, costPerOutput)
  const foodCostPercentage =
    input.menuPrice === null || input.menuPrice === '0'
      ? null
      : divideDecimals(multiplyDecimals(costPerOutput, '100'), input.menuPrice)

  return {
    status: input.batchCost === null ? 'partial' : 'complete',
    effectiveOutputQuantity,
    costPerOutput,
    menuPrice: input.menuPrice,
    plateMargin,
    foodCostPercentage,
    reason: input.menuPrice === null ? 'Menu price is not available.' : null,
  }
}

/**
 * Calculates the known cost of a recipe batch. Unknown costs stay visible as
 * partial rather than being treated as zero, and all arithmetic remains in
 * decimal strings so money never touches a float.
 */
export function calculateRecipeCost(
  ingredients: readonly RecipeCostIngredient[],
): RecipeCost {
  if (ingredients.length === 0) {
    return {
      status: 'empty',
      totalCost: null,
      lines: [],
      missingCostItemIds: [],
    }
  }

  let totalCost = '0'
  const missingCostItemIds: string[] = []
  const lines = ingredients.map((ingredient) => {
    if (ingredient.unitCost === null) {
      missingCostItemIds.push(ingredient.ingredientItemId)
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost: null,
        status: 'missing-cost' as const,
        detail: 'Unit cost is missing. Add it in the item master.',
      }
    }

    try {
      const quantityInItemUnit = convertQuantity(
        ingredient.quantity,
        ingredient.unit,
        ingredient.itemUnit,
        ingredient.casePackSize
          ? { casePackSize: ingredient.casePackSize }
          : undefined,
      )
      const cost = multiplyDecimals(quantityInItemUnit, ingredient.unitCost)
      totalCost = addDecimals(totalCost, cost)
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost,
        status: 'ready' as const,
        detail: `${quantityInItemUnit} ${ingredient.itemUnit} × ${ingredient.unitCost}`,
      }
    } catch (error) {
      const detail =
        error instanceof UnitConversionError
          ? error.message
          : 'The item units could not be converted.'
      return {
        ingredientItemId: ingredient.ingredientItemId,
        label: ingredient.label,
        cost: null,
        status: 'unit-mismatch' as const,
        detail,
      }
    }
  })

  const hasUnpricedLine = lines.some((line) => line.status !== 'ready')
  return {
    status: hasUnpricedLine ? 'partial' : 'complete',
    totalCost:
      totalCost === '0' && lines.every((line) => line.cost === null)
        ? null
        : totalCost,
    lines,
    missingCostItemIds,
  }
}
