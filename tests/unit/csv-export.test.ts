import { describe, expect, it } from 'vitest'
import { csvCell, toCSV } from '@/lib/csv/export'

describe('CSV export helpers', () => {
  it('escapes commas, quotes, and line breaks', () => {
    expect(csvCell('Kitchen, A')).toBe('"Kitchen, A"')
    expect(csvCell('say "hello"')).toBe('"say ""hello"""')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
  })

  it('creates a header and data rows', () => {
    expect(toCSV(['item', 'impact'], [['Salmon', 40]])).toBe(
      'item,impact\nSalmon,40',
    )
  })
})
