import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RecommendationProof } from './recommendation-proof'

describe('marketing recommendation proof', () => {
  it('renders the shipped card with a curated receipt for the headline figure', () => {
    const markup = renderToStaticMarkup(<RecommendationProof />)

    expect(markup).toContain('data-variant="marketing"')
    expect(markup).toContain('Heirloom tomato')
    expect(markup).toContain('About $1040 at risk from current spoilage')

    expect(markup).toContain('Real-world example')
    expect(markup).toContain('$55,000')
    expect(markup).toContain('$2,255')
    expect(markup).toContain('$1,540')
    expect(markup).toContain(
      'https://costorestaurante.com/EN/restaurant-food-waste-management-before-vs-after-masterestaurant-2026-data-and.html',
    )

    // The arithmetic, in plain-English terms rather than variable names.
    expect(markup).toContain('On hand at the last count')
    expect(markup).toContain('Your unit cost')
    expect(markup).toContain('At risk right now')

    // The files, with the row counts the engine was given.
    expect(markup).toContain('sales-export.csv')
    expect(markup).toContain('inventory-counts.csv')

    // The one assumption an operator can act on, and where to change it.
    expect(markup).toContain('Shelf life')
    expect(markup).toContain('Settings → Item master → shelf life')
  })

  it('keeps the engine trace and app-only actions off the marketing page', () => {
    const markup = renderToStaticMarkup(<RecommendationProof />)

    expect(markup).not.toContain('Ask about this')
    expect(markup).not.toContain('Show your work')

    // Engine tuning constants are the reason this section was unreadable.
    expect(markup).not.toContain('metrics.impact')
    expect(markup).not.toContain('metrics.ranking')
    expect(markup).not.toContain('PANTRYIQ_METRICS_CONFIG')
    expect(markup).not.toContain('weighted mean')

    // No engine variable name reaches a stranger's screen.
    for (const name of [
      'qtyOnHand',
      'qtySold',
      'qtyOrdered',
      'unitCost',
      'figureCount',
      'historicalSpoilageQty',
    ]) {
      expect(markup).not.toContain(name)
    }
  })

  it('states percentages at a readable precision', () => {
    const markup = renderToStaticMarkup(<RecommendationProof />)

    expect(markup).toContain('96.3% sell-through')
    expect(markup).not.toContain('96.296296%')
  })
})
