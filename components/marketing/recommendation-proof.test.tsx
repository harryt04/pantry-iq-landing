import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RecommendationProof } from './recommendation-proof'

describe('marketing recommendation proof', () => {
  it('renders the shipped card with engine-produced arithmetic and expanded evidence', () => {
    const markup = renderToStaticMarkup(<RecommendationProof />)

    expect(markup).toContain('A recommendation you can check.')
    expect(markup).toContain('data-variant="marketing"')
    expect(markup).toContain('Salmon')
    expect(markup).toContain('About $40 at risk from current spoilage')
    expect(markup).toContain('Result:')
    expect(markup).toContain('sales-export.csv')
    expect(markup).toContain('data-state="open"')
    expect(markup).not.toContain('Ask about this')
  })
})
