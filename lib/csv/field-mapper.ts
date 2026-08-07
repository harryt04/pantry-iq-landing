/**
 * AI-powered CSV field mapping module
 * Uses LLM to suggest mappings from CSV headers to standard transaction fields
 */

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { LanguageModelV3 } from '@ai-sdk/provider'

/**
 * Standard target fields for transaction data
 */
export const STANDARD_FIELDS = [
  'date',
  'item',
  'qty',
  'revenue',
  'cost',
  'unitCost',
  'qtyOnHand',
  'supplier',
  'deliveryDate',
  'snapshotType',
  'location',
  'source',
] as const

export type StandardField = (typeof STANDARD_FIELDS)[number]

export type ImportType =
  | 'transactions'
  | 'purchase_orders'
  | 'inventory_snapshots'

/**
 * Mapping type: source column name -> target standard field
 */
export type FieldMapping = Record<string, StandardField | null>

/**
 * Fallback mappings for common column name patterns
 *
 * Patterns are ordered by specificity (multi-word before single-word).
 * This helps the word-boundary matching prioritize more specific patterns.
 * Single-word patterns are kept minimal to avoid false positives.
 */
const FALLBACK_PATTERNS: Record<string, StandardField> = {
  // Date patterns (multi-word most specific first)
  'transaction date': 'date',
  'sale date': 'date',
  'purchase date': 'date',
  timestamp: 'date',
  date: 'date',
  time: 'date',

  // Item patterns (multi-word most specific first, single-word less likely)
  'product name': 'item',
  'item name': 'item',
  item: 'item',
  product: 'item',
  description: 'item',
  sku: 'item',
  // Removed: 'name' (too generic, causes "Server Name" -> item false positive)

  // Quantity patterns (keep only unambiguous)
  qty: 'qty',
  quantity: 'qty',
  'qty sold': 'qty',
  units: 'qty',
  // Removed: 'amount' (too generic, causes "Discount Amount", "Tax Amount" -> qty)
  // Removed: 'count' (too generic, causes "Guest Count" -> qty)

  // Revenue patterns (keep most specific)
  'sales amount': 'revenue',
  'total sales': 'revenue',
  'sale price': 'revenue',
  'unit price': 'revenue',
  revenue: 'revenue',
  sales: 'revenue',
  price: 'revenue',
  total: 'revenue',

  // Cost patterns
  'unit cost': 'cost',
  'cost price': 'cost',
  'purchase price': 'cost',
  cost: 'cost',
  cogs: 'cost',
  expense: 'cost',

  // Purchase order patterns
  supplier: 'supplier',
  vendor: 'supplier',
  'delivery date': 'deliveryDate',
  'expected delivery': 'deliveryDate',
  'purchase unit cost': 'unitCost',

  // Inventory snapshot patterns
  'qty on hand': 'qtyOnHand',
  'quantity on hand': 'qtyOnHand',
  'on hand': 'qtyOnHand',
  'on-hand': 'qtyOnHand',
  inventory: 'qtyOnHand',
  stock: 'qtyOnHand',
  'snapshot type': 'snapshotType',

  // Location patterns
  'store name': 'location',
  location: 'location',
  store: 'location',
  branch: 'location',
  warehouse: 'location',
}

/**
 * Normalize header for pattern matching
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim()
}

/**
 * Escape regex special characters for safe regex pattern construction
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find best fallback mapping for a header using pattern matching
 *
 * Word-boundary substring match: only match if the pattern appears
 * as a complete word segment in the header (not as a substring of
 * an unrelated word). Check that the pattern is preceded and followed
 * by a word boundary (start/end, space, underscore, hyphen).
 */
function findFallbackMapping(header: string): StandardField | null {
  const normalized = normalizeHeader(header)

  // Exact match
  if (FALLBACK_PATTERNS[normalized]) {
    return FALLBACK_PATTERNS[normalized]
  }

  // Word-boundary substring match
  for (const [pattern, field] of Object.entries(FALLBACK_PATTERNS)) {
    const regex = new RegExp(
      `(?:^|[\\s_-])${escapeRegex(pattern)}(?:$|[\\s_-])`,
    )
    if (regex.test(normalized)) {
      return field
    }
  }

  return null
}

/**
 * Check if an API key is valid (not stubbed or empty)
 *
 * @param apiKey - The API key to check
 * @returns true if the key looks valid, false if stubbed or empty
 */
function isValidApiKey(apiKey?: string): boolean {
  if (!apiKey) return false
  // Check if key is stubbed (common test value) or obviously invalid
  const lowered = apiKey.toLowerCase().trim()
  // Reject common stub patterns
  if (lowered.includes('stub') || lowered === 'test' || lowered === '') {
    return false
  }
  // Require some minimum length (most real keys are longer than 20 chars)
  if (apiKey.length < 20) {
    return false
  }
  return true
}

/**
 * Suggest field mappings using LLM
 *
 * @param headers - CSV column headers
 * @param sample - Sample rows from CSV (first 5-10 rows)
 * @returns Mapping of source columns to target fields
 */
export async function suggestMappings(
  headers: string[],
  sample: Record<string, string>[],
  importType: ImportType = 'transactions',
): Promise<FieldMapping> {
  // Check which providers are available with VALID keys
  const hasOpenAI = isValidApiKey(process.env.OPENAI_API_KEY)
  const hasAnthropic = isValidApiKey(process.env.ANTHROPIC_API_KEY)
  const hasGoogle = isValidApiKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY)

  // Fallback to pattern matching if no LLM available
  if (!hasOpenAI && !hasAnthropic && !hasGoogle) {
    console.warn(
      'No valid LLM providers available, using pattern matching fallback',
    )
    return fallbackMappings(headers)
  }

  try {
    // Use the first available provider
    let model: LanguageModelV3
    if (hasAnthropic) {
      model = anthropic('claude-3-5-haiku-20241022')
    } else if (hasOpenAI) {
      model = openai('gpt-4o-mini')
    } else {
      model = google('gemini-2.0-flash-lite')
    }

    // Prepare sample data summary for the prompt
    const sampleSummary = sample.slice(0, 3).map((row) =>
      Object.entries(row)
        .map(([k, v]) => `${k}: "${v.substring(0, 20)}"`)
        .join(', '),
    )

    const prompt = `You are a data expert. Analyze these CSV column headers and suggest how they map to standard ${importType} fields.

Standard fields available: ${STANDARD_FIELDS.join(', ')}

Column headers: ${headers.join(', ')}

Sample data (first 3 rows):
${sampleSummary.map((s) => `- ${s}`).join('\n')}

Return a JSON object with a "mapping" key containing the field mapping. Each key is a column header, and the value is the target field or null if unmappable.
For example: {"mapping": {"Date": "date", "Product": "item", "Quantity": "qty", "Unit Price": "cost", "Seller": null}}

Always return valid JSON.`

    const text = await generateText({
      model,
      prompt,
      temperature: 0.3,
    })

    // Parse JSON from response
    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Could not extract JSON from LLM response:', text.text)
      return fallbackMappings(headers)
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.mapping || typeof parsed.mapping !== 'object') {
      console.error('Invalid mapping structure in LLM response')
      return fallbackMappings(headers)
    }

    // Validate and clean the mapping
    const mapping: FieldMapping = {}
    for (const [key, value] of Object.entries(parsed.mapping)) {
      if (value === null || value === undefined) {
        mapping[key] = null
      } else if (STANDARD_FIELDS.includes(value as StandardField)) {
        mapping[key] = value as StandardField
      } else {
        mapping[key] = null
      }
    }

    return mapping
  } catch (error) {
    console.error('LLM field mapping error:', error)
    // Fallback to pattern matching on error
    return fallbackMappings(headers)
  }
}

/**
 * Fallback mapping using pattern matching
 *
 * Prevents duplicate target field assignments: multiple columns can match
 * the same target field (e.g., "Date" and "Time" both match 'date').
 * This tracks which targets have been assigned and uses first-match-wins
 * to preserve the correct value and prevent last-write-wins overwrites.
 */
function fallbackMappings(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {}
  const assignedTargets = new Set<StandardField>()

  for (const header of headers) {
    const target = findFallbackMapping(header)
    if (target && !assignedTargets.has(target)) {
      // Target field not yet assigned -- claim it
      mapping[header] = target
      assignedTargets.add(target)
    } else if (target && assignedTargets.has(target)) {
      // Target field already assigned -- skip duplicate
      mapping[header] = null
    } else {
      // No match found
      mapping[header] = null
    }
  }

  return mapping
}

/**
 * Validate that all required fields are mapped
 *
 * @param mapping - Field mapping to validate
 * @param requiredFields - Fields that must be mapped (default: ['item'])
 * @returns Error message or null if valid
 */
export function validateMapping(
  mapping: FieldMapping,
  requiredFields: StandardField[] = ['item'],
): string | null {
  // Check if all required fields are mapped
  const mappedFields = new Set(Object.values(mapping).filter((v) => v !== null))

  for (const required of requiredFields) {
    if (!mappedFields.has(required)) {
      return `Missing required field: ${required}`
    }
  }

  return null
}

/**
 * Normalize a value based on the target field type
 *
 * @param value - Raw value to normalize
 * @param field - Target field type
 * @returns Normalized value
 */
export function normalizeValue(
  value: string,
  field: StandardField,
): string | number | null {
  if (!value || value.trim() === '') {
    return null
  }

  const trimmed = value.trim()

  switch (field) {
    case 'date':
    case 'deliveryDate': {
      // Try to parse and normalize to ISO format
      const date = parseDate(trimmed)
      return date ? date.toISOString().split('T')[0] : null
    }

    case 'qty':
    case 'qtyOnHand':
    case 'revenue':
    case 'cost':
    case 'unitCost': {
      // Parse as number
      const num = parseFloat(trimmed)
      return !isNaN(num) ? num : null
    }

    case 'item':
    case 'supplier':
    case 'snapshotType':
    case 'location':
    case 'source':
    default: {
      // Keep as string
      return trimmed
    }
  }
}

/**
 * Parse various date formats to Date object
 */
function parseDate(dateString: string): Date | null {
  // Try ISO format first
  const iso = new Date(dateString)
  if (!isNaN(iso.getTime())) {
    return iso
  }

  // Try common US formats: MM/DD/YYYY, MM-DD-YYYY, M/D/YYYY
  const usFormats = [
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, // YYYY-MM-DD
  ]

  for (const format of usFormats) {
    const match = dateString.match(format)
    if (match) {
      let month, day, year
      if (format === usFormats[0]) {
        ;[, month, day, year] = match
      } else {
        ;[, year, month, day] = match
      }

      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}

/**
 * Apply field mapping to normalize a row
 *
 * @param row - Raw CSV row
 * @param mapping - Field mapping
 * @returns Normalized row with standard field names
 */
export function applyMapping(
  row: Record<string, string>,
  mapping: FieldMapping,
): Partial<Record<StandardField, string | number | null>> {
  const normalized: Partial<Record<StandardField, string | number | null>> = {}

  for (const [sourceColumn, targetField] of Object.entries(mapping)) {
    if (targetField && row[sourceColumn] !== undefined) {
      normalized[targetField] = normalizeValue(row[sourceColumn], targetField)
    }
  }

  return normalized
}
