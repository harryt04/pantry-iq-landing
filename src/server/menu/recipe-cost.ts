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
  const raw = parts.digits.toString().padStart(parts.scale + 1, '0')
  if (parts.scale === 0) return raw
  return `${raw.slice(0, -parts.scale)}.${raw.slice(-parts.scale)}`.replace(
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
