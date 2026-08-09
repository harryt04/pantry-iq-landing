import { convertQuantity, UnitConversionError } from './unit-conversion'

type Decimal = { coefficient: bigint; scale: number }

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/

function parseDecimal(value: string): Decimal {
  if (!DECIMAL_PATTERN.test(value.trim()))
    throw new Error(`Invalid decimal: ${value}`)
  const normalized = value.trim()
  const negative = normalized.startsWith('-')
  const unsigned = normalized.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsigned.split('.')
  return normalize({
    coefficient:
      BigInt(`${whole || '0'}${fraction}` || '0') * (negative ? -1n : 1n),
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

function decimalString(value: Decimal): string {
  const normalized = normalize(value)
  if (normalized.coefficient === 0n) return '0'
  const negative = normalized.coefficient < 0n
  const digits = (negative ? -normalized.coefficient : normalized.coefficient)
    .toString()
    .padStart(normalized.scale + 1, '0')
  if (normalized.scale === 0) return `${negative ? '-' : ''}${digits}`
  return `${negative ? '-' : ''}${digits.slice(0, -normalized.scale)}.${digits.slice(-normalized.scale)}`
}

function add(left: string, right: string): string {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const scale = Math.max(a.scale, b.scale)
  return decimalString(
    normalize({
      coefficient:
        a.coefficient * 10n ** BigInt(scale - a.scale) +
        b.coefficient * 10n ** BigInt(scale - b.scale),
      scale,
    }),
  )
}

function subtract(left: string, right: string): string {
  const parsed = parseDecimal(right)
  return add(
    left,
    decimalString({ coefficient: -parsed.coefficient, scale: parsed.scale }),
  )
}

function multiply(left: string, right: string): string {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  return decimalString(
    normalize({
      coefficient: a.coefficient * b.coefficient,
      scale: a.scale + b.scale,
    }),
  )
}

function divideExact(left: string, right: string): string {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  if (b.coefficient === 0n) throw new Error('Cannot divide by zero.')
  let numerator = a.coefficient * 10n ** BigInt(b.scale)
  let denominator = b.coefficient * 10n ** BigInt(a.scale)

  const negative = numerator < 0n !== denominator < 0n
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let reducedNumerator = absoluteNumerator
  let reducedDenominator = absoluteDenominator
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
  if (reducedDenominator !== 1n) {
    throw new Error('This conversion does not have an exact decimal result.')
  }
  const scale = Math.max(twos, fives)
  reducedNumerator *= 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives)
  return decimalString({
    coefficient: negative ? -reducedNumerator : reducedNumerator,
    scale,
  })
}

function divideRounded(left: string, right: string, scale = 6): string {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  if (b.coefficient === 0n) throw new Error('Cannot divide by zero.')
  const numerator = a.coefficient * 10n ** BigInt(b.scale + scale)
  const denominator = b.coefficient * 10n ** BigInt(a.scale)
  const negative = numerator < 0n !== denominator < 0n
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator)
    quotient += 1n
  return decimalString({
    coefficient: negative ? -quotient : quotient,
    scale,
  })
}

function isNegative(value: string) {
  return parseDecimal(value).coefficient < 0n
}

function compareDecimal(left: string, right: string) {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const scale = Math.max(a.scale, b.scale)
  const leftCoefficient = a.coefficient * 10n ** BigInt(scale - a.scale)
  const rightCoefficient = b.coefficient * 10n ** BigInt(scale - b.scale)
  return leftCoefficient < rightCoefficient
    ? -1
    : leftCoefficient > rightCoefficient
      ? 1
      : 0
}

function absolute(value: string) {
  const parsed = parseDecimal(value)
  return decimalString({
    coefficient:
      parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient,
    scale: parsed.scale,
  })
}

export type UsageSale = {
  menuItemId: string
  qty: string
  transactedAt: Date
}

export type UsagePurchase = {
  inventoryItemId: string
  qty: string
  unit: string
  orderedAt: Date
}

export type UsageSnapshot = {
  inventoryItemId: string
  qty: string
  countedAt: Date
}

export type UsageConversion = {
  inventoryItemId: string
  fromUnit: string
  toUnit: string
  factor: string
}

export type UsageIngredient = {
  ingredientItemId?: string
  subRecipeId?: string
  quantity: string
  unit: string
}

export type UsageRecipe = {
  id: string
  menuItemId: string
  outputQuantity: string
  outputUnit: string
  yieldFactor: string
  wasteFactor: string
  ingredients: readonly UsageIngredient[]
}

export type UsageInventoryItem = {
  id: string
  displayName: string
  unit: string
}

export type UsageVarianceInput = {
  inventoryItems: readonly UsageInventoryItem[]
  recipes: readonly UsageRecipe[]
  sales: readonly UsageSale[]
  purchases: readonly UsagePurchase[]
  snapshots: readonly UsageSnapshot[]
  conversions?: readonly UsageConversion[]
  periodStart?: Date
  periodEnd?: Date
}

export type UsageVarianceRow = {
  ingredientItemId: string
  ingredientName: string
  unit: string
  theoreticalUsage: string
  actualUsage: string | null
  variance: string | null
  variancePercent: string | null
  status: 'calculated' | 'cannot-calculate'
  reason: string | null
  possibleExplanations: readonly string[]
}

export type UsageVarianceExclusion = {
  menuItemId: string
  reason: string
}

export type WasteAttributionMenuRow = {
  menuItemId: string
  theoreticalUsage: string
  attributedWaste: string | null
}

export type WasteAttributionRow = {
  ingredientItemId: string
  ingredientName: string
  unit: string
  totalUsage: string | null
  attributedUsage: string
  unattributedUsage: string | null
  excessUsage: string | null
  unattributedExcess: string | null
  status: 'calculated' | 'cannot-calculate'
  reason: string | null
  menuItems: readonly WasteAttributionMenuRow[]
}

export type UsageVarianceResult = {
  rows: readonly UsageVarianceRow[]
  excluded: readonly UsageVarianceExclusion[]
  wasteAttribution: readonly WasteAttributionRow[]
  periodStart: string | null
  periodEnd: string | null
}

type Requirement = { quantity: string; unit: string }
type RequirementMap = Map<string, Requirement[]>

function effectiveOutputQuantity(recipe: UsageRecipe) {
  return multiply(
    multiply(recipe.outputQuantity, recipe.yieldFactor),
    subtract('1', recipe.wasteFactor),
  )
}

function conversionKey(itemId: string, fromUnit: string, toUnit: string) {
  return `${itemId}\u0000${fromUnit.trim().toLowerCase()}\u0000${toUnit.trim().toLowerCase()}`
}

function convertUsageQuantity(
  quantity: string,
  fromUnit: string,
  toUnit: string,
  itemId: string,
  conversions: Map<string, UsageConversion>,
) {
  if (fromUnit.trim().toLowerCase() === toUnit.trim().toLowerCase())
    return quantity

  const direct = conversions.get(conversionKey(itemId, fromUnit, toUnit))
  if (direct) return multiply(quantity, direct.factor)

  const reverse = conversions.get(conversionKey(itemId, toUnit, fromUnit))
  if (reverse) return divideExact(quantity, reverse.factor)

  const negative = isNegative(quantity)
  const converted = convertQuantity(
    negative ? absolute(quantity) : quantity,
    fromUnit,
    toUnit,
  )
  return negative ? `-${converted}` : converted
}

function mergeRequirement(
  requirements: RequirementMap,
  itemId: string,
  quantity: string,
  unit: string,
) {
  const lines = requirements.get(itemId) ?? []
  lines.push({ quantity, unit })
  requirements.set(itemId, lines)
}

function buildRecipeRequirements(
  recipeId: string,
  recipes: Map<string, UsageRecipe>,
  memo: Map<string, RequirementMap>,
  visiting: Set<string>,
  conversions: Map<string, UsageConversion>,
): RequirementMap {
  const cached = memo.get(recipeId)
  if (cached) return cached
  if (visiting.has(recipeId)) throw new Error('Recipe cycle detected.')
  const recipe = recipes.get(recipeId)
  if (!recipe) throw new Error('Recipe reference is missing.')

  const outputQuantity = effectiveOutputQuantity(recipe)
  if (outputQuantity === '0') throw new Error('Recipe output is empty.')
  visiting.add(recipeId)
  const requirements: RequirementMap = new Map()

  for (const ingredient of recipe.ingredients) {
    const perOutput = divideRounded(ingredient.quantity, outputQuantity)
    if (ingredient.ingredientItemId) {
      mergeRequirement(
        requirements,
        ingredient.ingredientItemId,
        perOutput,
        ingredient.unit,
      )
      continue
    }
    if (!ingredient.subRecipeId) throw new Error('Recipe ingredient is empty.')
    const subRecipe = recipes.get(ingredient.subRecipeId)
    if (!subRecipe) throw new Error('Recipe reference is missing.')
    const subRecipeRequirements = buildRecipeRequirements(
      ingredient.subRecipeId,
      recipes,
      memo,
      visiting,
      conversions,
    )
    const subRecipeOutput = convertUsageQuantity(
      perOutput,
      ingredient.unit,
      subRecipe.outputUnit,
      subRecipe.menuItemId,
      conversions,
    )
    for (const [itemId, lines] of subRecipeRequirements) {
      for (const line of lines)
        mergeRequirement(
          requirements,
          itemId,
          multiply(line.quantity, subRecipeOutput),
          line.unit,
        )
    }
  }

  visiting.delete(recipeId)
  memo.set(recipeId, requirements)
  return requirements
}

function dateKey(value: Date | null) {
  return value?.toISOString() ?? null
}

function latestSnapshotWindow(
  snapshots: readonly UsageSnapshot[],
  itemId: string,
  periodStart: Date | undefined,
  periodEnd: Date | undefined,
) {
  const available = snapshots
    .filter(
      (snapshot) =>
        snapshot.inventoryItemId === itemId &&
        (!periodStart || snapshot.countedAt >= periodStart) &&
        (!periodEnd || snapshot.countedAt <= periodEnd),
    )
    .sort((left, right) => left.countedAt.getTime() - right.countedAt.getTime())
  const ending = available.at(-1)
  const beginning = available.at(-2)
  return ending && beginning ? { beginning, ending } : null
}

function possibleExplanations(variance: string) {
  if (isNegative(variance))
    return [
      'Sales and count timing may not line up.',
      'The recipe may overstate ingredient usage.',
      'Transfers or credits may not be recorded in the source data.',
    ]
  return [
    'Over-portioning may be contributing.',
    'Unrecorded waste may be contributing.',
    'Theft or loss is a possibility.',
    'The recipe may be wrong or out of date.',
  ]
}

function variancePercent(variance: string, theoretical: string) {
  if (theoretical === '0') return null
  return divideRounded(multiply(variance, '100'), theoretical)
}

function maxZero(value: string) {
  return isNegative(value) ? '0' : value
}

function actualUsageForItem(
  input: UsageVarianceInput,
  item: UsageInventoryItem,
  window: ReturnType<typeof latestSnapshotWindow>,
  conversions: Map<string, UsageConversion>,
) {
  if (!window) return null
  return add(
    add(
      window.beginning.qty,
      input.purchases
        .filter(
          (purchase) =>
            purchase.inventoryItemId === item.id &&
            purchase.orderedAt > window.beginning.countedAt &&
            purchase.orderedAt <= window.ending.countedAt,
        )
        .reduce((total, purchase) => {
          try {
            return add(
              total,
              convertUsageQuantity(
                purchase.qty,
                purchase.unit,
                item.unit,
                item.id,
                conversions,
              ),
            )
          } catch {
            return total
          }
        }, '0'),
    ),
    `-${window.ending.qty}`,
  )
}

/**
 * Allocates an excess usage quantity by each dish's recipe-derived share.
 * The final row receives the exact remainder so rounded display values still
 * reconcile to the ingredient total.
 */
function allocateExcess(
  excess: string,
  menuUsage: readonly [string, string][],
): Map<string, string> {
  const allocations = new Map<string, string>()
  const totalTheoretical = menuUsage.reduce(
    (total, [, usage]) => add(total, usage),
    '0',
  )
  if (totalTheoretical === '0') return allocations

  let allocated = '0'
  menuUsage.forEach(([menuItemId, usage], index) => {
    const isLast = index === menuUsage.length - 1
    const value = isLast
      ? subtract(excess, allocated)
      : divideRounded(multiply(excess, usage), totalTheoretical)
    allocations.set(menuItemId, value)
    allocated = add(allocated, value)
  })
  return allocations
}

/**
 * Compares recipe-derived ingredient use with physical-count usage. A pair
 * of counts is required for actual usage; purchases only bridge those counts.
 * This keeps physical snapshots authoritative and never turns a missing count
 * into a made-up zero.
 */
export function buildUsageVariance(
  input: UsageVarianceInput,
): UsageVarianceResult {
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]))
  const recipesById = new Map(
    input.recipes.map((recipe) => [recipe.id, recipe]),
  )
  const recipeByMenuItem = new Map<string, UsageRecipe>()
  for (const recipe of input.recipes) {
    if (!recipeByMenuItem.has(recipe.menuItemId))
      recipeByMenuItem.set(recipe.menuItemId, recipe)
  }
  const conversions = new Map(
    (input.conversions ?? []).map((conversion) => [
      conversionKey(
        conversion.inventoryItemId,
        conversion.fromUnit,
        conversion.toUnit,
      ),
      conversion,
    ]),
  )
  const memo = new Map<string, RequirementMap>()
  const exclusions: UsageVarianceExclusion[] = []
  const theoreticalByItem = new Map<string, string>()
  const theoreticalByItemAndMenu = new Map<string, Map<string, string>>()

  const sortedSales = [...input.sales].sort(
    (left, right) => left.transactedAt.getTime() - right.transactedAt.getTime(),
  )
  for (const menuItemId of new Set(
    sortedSales.map((sale) => sale.menuItemId),
  )) {
    const recipe = recipeByMenuItem.get(menuItemId)
    if (!recipe) {
      exclusions.push({
        menuItemId,
        reason: 'No active recipe; its ingredients are excluded from variance.',
      })
      continue
    }
    let requirements: RequirementMap
    try {
      requirements = buildRecipeRequirements(
        recipe.id,
        recipesById,
        memo,
        new Set(),
        conversions,
      )
    } catch (error) {
      exclusions.push({
        menuItemId,
        reason: `Recipe excluded: ${error instanceof Error ? error.message : 'it could not be expanded.'}`,
      })
      continue
    }
    const sales = sortedSales.filter(
      (sale) =>
        sale.menuItemId === menuItemId &&
        (!input.periodStart || sale.transactedAt >= input.periodStart) &&
        (!input.periodEnd || sale.transactedAt <= input.periodEnd),
    )
    for (const [itemId, lines] of requirements) {
      const item = itemsById.get(itemId)
      if (!item) continue
      const window = latestSnapshotWindow(
        input.snapshots,
        itemId,
        input.periodStart,
        input.periodEnd,
      )
      const comparableSales = sales.filter(
        (sale) =>
          (!window || sale.transactedAt > window.beginning.countedAt) &&
          (!window || sale.transactedAt <= window.ending.countedAt),
      )
      for (const sale of comparableSales) {
        for (const line of lines) {
          const quantity = multiply(line.quantity, sale.qty)
          let canonicalQuantity: string
          try {
            canonicalQuantity = convertUsageQuantity(
              quantity,
              line.unit,
              item.unit,
              item.id,
              conversions,
            )
          } catch {
            continue
          }
          theoreticalByItem.set(
            itemId,
            add(theoreticalByItem.get(itemId) ?? '0', canonicalQuantity),
          )
          const menuUsage =
            theoreticalByItemAndMenu.get(itemId) ?? new Map<string, string>()
          menuUsage.set(
            menuItemId,
            add(menuUsage.get(menuItemId) ?? '0', canonicalQuantity),
          )
          theoreticalByItemAndMenu.set(itemId, menuUsage)
        }
      }
    }
  }

  const rows = [...theoreticalByItem.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((itemId): UsageVarianceRow => {
      const item = itemsById.get(itemId) as UsageInventoryItem
      const window = latestSnapshotWindow(
        input.snapshots,
        itemId,
        input.periodStart,
        input.periodEnd,
      )
      let actualUsage: string | null = null
      let reason: string | null = null
      if (!window) {
        reason = 'Need two inventory counts in the selected period.'
      } else {
        actualUsage = actualUsageForItem(input, item, window, conversions)
      }

      const theoreticalUsage = theoreticalByItem.get(itemId) ?? '0'
      if (actualUsage === null)
        return {
          ingredientItemId: itemId,
          ingredientName: item.displayName,
          unit: item.unit,
          theoreticalUsage,
          actualUsage,
          variance: null,
          variancePercent: null,
          status: 'cannot-calculate',
          reason,
          possibleExplanations: [],
        }
      const variance = subtract(actualUsage, theoreticalUsage)
      return {
        ingredientItemId: itemId,
        ingredientName: item.displayName,
        unit: item.unit,
        theoreticalUsage,
        actualUsage,
        variance,
        variancePercent: variancePercent(variance, theoreticalUsage),
        status: 'calculated',
        reason: null,
        possibleExplanations: possibleExplanations(variance),
      }
    })

  const attributionItemIds = new Set(theoreticalByItem.keys())
  for (const snapshot of input.snapshots)
    attributionItemIds.add(snapshot.inventoryItemId)
  const wasteAttribution = [...attributionItemIds]
    .map((itemId): WasteAttributionRow | null => {
      const item = itemsById.get(itemId)
      if (!item) return null
      const window = latestSnapshotWindow(
        input.snapshots,
        itemId,
        input.periodStart,
        input.periodEnd,
      )
      const actualUsage = actualUsageForItem(input, item, window, conversions)
      const menuUsage = [
        ...(theoreticalByItemAndMenu.get(itemId) ?? new Map()),
      ].sort(([left], [right]) => left.localeCompare(right))
      const attributedUsage = menuUsage.reduce(
        (total, [, usage]) => add(total, usage),
        '0',
      )
      const unattributedUsage =
        actualUsage === null ? null : subtract(actualUsage, attributedUsage)
      const excessUsage =
        unattributedUsage === null ? null : maxZero(unattributedUsage)
      const allocations =
        excessUsage === null
          ? new Map<string, string>()
          : allocateExcess(excessUsage, menuUsage)
      const attributedExcess = [...allocations.values()].reduce(
        (total, value) => add(total, value),
        '0',
      )
      return {
        ingredientItemId: item.id,
        ingredientName: item.displayName,
        unit: item.unit,
        totalUsage: actualUsage,
        attributedUsage,
        unattributedUsage,
        excessUsage,
        unattributedExcess:
          excessUsage === null ? null : subtract(excessUsage, attributedExcess),
        status: actualUsage === null ? 'cannot-calculate' : 'calculated',
        reason:
          actualUsage === null
            ? 'Need two inventory counts in the selected period.'
            : null,
        menuItems: menuUsage
          .map(([menuItemId, theoreticalUsage]) => ({
            menuItemId,
            theoreticalUsage,
            attributedWaste:
              excessUsage === null
                ? null
                : (allocations.get(menuItemId) ?? '0'),
          }))
          .sort((left, right) => {
            if (left.attributedWaste === null || right.attributedWaste === null)
              return left.menuItemId.localeCompare(right.menuItemId)
            const leftNegative = isNegative(left.attributedWaste)
            const rightNegative = isNegative(right.attributedWaste)
            if (leftNegative !== rightNegative) return leftNegative ? 1 : -1
            const wasteOrder = compareDecimal(
              right.attributedWaste,
              left.attributedWaste,
            )
            if (wasteOrder !== 0) return wasteOrder
            return left.menuItemId.localeCompare(right.menuItemId)
          }),
      }
    })
    .filter((row): row is WasteAttributionRow => row !== null)
    .sort((left, right) =>
      left.ingredientItemId.localeCompare(right.ingredientItemId),
    )

  return {
    rows,
    excluded: exclusions.sort((left, right) =>
      left.menuItemId.localeCompare(right.menuItemId),
    ),
    wasteAttribution,
    periodStart: dateKey(input.periodStart ?? null),
    periodEnd: dateKey(input.periodEnd ?? null),
  }
}

export { UnitConversionError }
