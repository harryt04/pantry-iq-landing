import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RankedProof } from './ranked-proof'

describe('marketing ranked proof', () => {
  it('shows monthly purchasing scale separately from current dollars at risk', () => {
    const markup = renderToStaticMarkup(<RankedProof />)

    for (const value of ['$12,000', '$10,400', '$14,000', '$6,800']) {
      expect(markup).toContain(value)
    }
    for (const value of ['$1400', '$1280', '$1050', '$1040', '$680']) {
      expect(markup).toContain(value)
    }
    expect(markup).toContain('Monthly purchasing volume')
    expect(markup).toContain('These five categories total about')
    expect(markup).toContain('current dollars at risk')
    expect(markup).toContain('Ranked by dollars at risk')
    expect(markup).toContain('surface-proof__purchase-leader')
    expect(markup).toContain('Legend for dollars at risk by item')
    expect(markup).toContain('legend-salmon-fillet-0-solid-0')
    expect(markup).toContain('legend-heirloom-tomato-1-hatch-0')
    expect(markup).toContain('legend-ribeye-12oz-2-cross-0')
    expect(markup).toContain('legend-burrata-3-dots-0')
    expect(markup).toContain('legend-sourdough-loaf-4-vertical-0')
  })
})
