/**
 * Post-generation grounding checks. The model is allowed to narrate values
 * already present in the deterministic inputs, but it cannot introduce a new
 * numeric figure that a caller could mistake for PantryIQ's analysis.
 */

const NUMERIC_TOKEN =
  /(?<![A-Za-z])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?![A-Za-z])/g

function normalizeNumericToken(token: string) {
  const unsigned = token.replace(/[,$%]/g, '')
  const negative = unsigned.startsWith('-')
  const unsignedDigits = unsigned.replace(/^[+-]/, '')
  const [whole = '0', fraction = ''] = unsignedDigits.split('.')
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  const normalizedFraction = fraction.replace(/0+$/, '')
  const value = normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole

  return value === '0' ? value : `${negative ? '-' : ''}${value}`
}

function numericTokens(value: string) {
  return [...value.matchAll(NUMERIC_TOKEN)].map(([token]) => token)
}

export type GroundingCheck = {
  accepted: boolean
  unmatchedNumbers: string[]
}

export type LocationNameCheck = {
  accepted: boolean
  missingLocationNames: string[]
}

/**
 * Checks generated figures against the serialized, location-scoped inputs.
 * Matching is exact after harmless presentation differences such as commas,
 * currency symbols, percent signs, and trailing decimal zeroes are removed.
 */
export function checkGrounding(
  response: string,
  sources: readonly unknown[],
): GroundingCheck {
  const allowedNumbers = new Set(
    sources
      .flatMap((source) => numericTokens(JSON.stringify(source)))
      .map(normalizeNumericToken),
  )
  const unmatchedNumbers = [
    ...new Set(
      numericTokens(response)
        .filter((token) => !allowedNumbers.has(normalizeNumericToken(token)))
        .map(normalizeNumericToken),
    ),
  ]

  return {
    accepted: unmatchedNumbers.length === 0,
    unmatchedNumbers,
  }
}

/** Cross-location narration must identify every location in its context. */
export function checkRequiredLocationNames(
  response: string,
  requiredLocationNames: readonly string[],
): LocationNameCheck {
  const missingLocationNames = requiredLocationNames.filter(
    (name) => !response.toLocaleLowerCase().includes(name.toLocaleLowerCase()),
  )
  return {
    accepted: missingLocationNames.length === 0,
    missingLocationNames,
  }
}
