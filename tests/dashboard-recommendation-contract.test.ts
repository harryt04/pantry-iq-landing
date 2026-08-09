import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  new URL('../app/(app)/dashboard/page.tsx', import.meta.url),
  'utf8',
)
const component = readFileSync(
  new URL('../components/dashboard/recommendation-card.tsx', import.meta.url),
  'utf8',
)

describe('dashboard recommendation card contract', () => {
  it('loads owner-scoped ranked recommendations only for the ready dashboard', () => {
    expect(page).toContain('getDashboardRecommendations')
    expect(page).toContain('<RecommendationCardList')
    expect(component).toContain("variant = 'dashboard'")
  })

  it('keeps facts, predictions, and suggested actions distinct', () => {
    expect(component).toContain('Observed:')
    expect(component).toContain('Prediction:')
    expect(component).toContain('Observation only:')
    expect(component).toContain('Consider')
    expect(component).not.toMatch(/Offer to a shelter|thumbs up|thumbs down/i)
  })

  it('uses the shared surface variants for future chat and marketing renders', () => {
    expect(component).toContain("'chat'")
    expect(component).toContain("'marketing'")
    expect(component).toContain('data-variant={variant}')
  })
})
