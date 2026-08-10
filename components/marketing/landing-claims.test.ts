import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Claims discipline for the landing page — `docs/brand/marketing-copy.md` §7.
 * Every claim on the marketing site must be true of the product today.
 *
 * This restates the guard that used to live in `app/marketing-claims.test.ts`.
 */
const landingPage = readFileSync(
  new URL('../../app/page.tsx', import.meta.url),
  'utf8',
)

describe('landing page claims discipline', () => {
  it('promises no integration, alert, or multi-location capability', () => {
    for (const phrase of [
      'POS integration',
      'Square',
      'Toast',
      'compare locations',
      'across locations',
      'email alert',
      'notification',
      'pour cost',
    ]) {
      expect(landingPage.toLowerCase()).not.toContain(phrase.toLowerCase())
    }
  })

  it('does not claim donation is available', () => {
    for (const phrase of ['shelter', 'donate', 'donation', 'surplus']) {
      expect(landingPage.toLowerCase()).not.toContain(phrase.toLowerCase())
    }
  })

  it('uses none of the banned marketing vocabulary', () => {
    for (const word of [
      'AI-powered',
      'revolutionary',
      'seamless',
      'effortless',
      'unlock',
      'leverage',
      'supercharge',
      'game-changing',
      'best-in-class',
      'cutting-edge',
      'robust',
      'holistic',
      'ecosystem',
    ]) {
      expect(landingPage.toLowerCase()).not.toContain(word.toLowerCase())
    }
  })

  it('makes no customer, testimonial, or industry-statistic claim', () => {
    for (const phrase of [
      'testimonial',
      'trusted by',
      'customers use',
      'billion',
      '% of restaurants',
    ]) {
      expect(landingPage.toLowerCase()).not.toContain(phrase.toLowerCase())
    }
  })

  it('labels the worked example rather than passing it off as the reader’s data', () => {
    expect(landingPage).toContain('worked example')
  })
})
