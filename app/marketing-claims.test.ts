import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const landingPage = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const marketingCopy = readFileSync(
  new URL('../docs/brand/marketing-copy.md', import.meta.url),
  'utf8',
)

describe('marketing claims discipline', () => {
  it('does not publish the retired chat promise', () => {
    expect(landingPage).not.toContain('Ask it anything.')
    expect(marketingCopy).not.toContain('3. **Ask it anything.')
  })

  it('does not claim that unshipped import or donation flows are live', () => {
    for (const phrase of [
      'Under 5 min',
      'Upload to first insight',
      'Traceable to a row you uploaded',
      'surplus to a shelter nearby',
      'Messy is fine',
    ]) {
      expect(landingPage).not.toContain(phrase)
    }
  })
})
