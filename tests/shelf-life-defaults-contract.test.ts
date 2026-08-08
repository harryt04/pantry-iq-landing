import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const defaults = readFileSync(
  new URL('../src/server/inventory/shelf-life-defaults.ts', import.meta.url),
  'utf8',
)
const route = readFileSync(
  new URL('../app/api/items/route.ts', import.meta.url),
  'utf8',
)
const surface = readFileSync(
  new URL('../components/settings/item-master.tsx', import.meta.url),
  'utf8',
)

describe('shelf-life defaults contract', () => {
  it('keeps defaults in one committed module and resolves overrides first', () => {
    expect(defaults).toContain('SHELF_LIFE_DEFAULTS')
    expect(defaults).toContain("source: 'user'")
    expect(defaults).toContain("source: 'suggestion'")
  })

  it('publishes effective values with their source so the UI cannot present guesses as facts', () => {
    expect(route).toContain('effectiveShelfLifeDays')
    expect(route).toContain('shelfLifeSource')
    expect(surface).toContain('Suggested for')
    expect(surface).toContain('suggestions available')
  })

  it('keeps category entry extendable through a datalist rather than a closed enum', () => {
    expect(surface).toContain('list="pantryiq-item-categories"')
    expect(surface).toContain('<datalist id="pantryiq-item-categories">')
  })
})
