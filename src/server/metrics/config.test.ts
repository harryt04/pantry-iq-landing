import { describe, expect, it } from 'vitest'

import { DEFAULT_METRICS_CONFIG, parseMetricsConfig } from './config'
import { rankRecommendations } from './ranking'

describe('metrics configuration', () => {
  it('exposes the documented defaults from one source', () => {
    const config = parseMetricsConfig({})

    expect(config).toEqual(DEFAULT_METRICS_CONFIG)
    expect(config.impact.thresholds).toEqual({
      highImpactDollars: '100',
      mediumImpactDollars: '25',
      lowImpactDollars: '0',
    })
  })

  it('allows a valid ranking weight change without changing engine code', () => {
    const config = parseMetricsConfig({
      ranking: {
        weights: { impact: '0.70', urgency: '0.20', dataSufficiency: '0.10' },
      },
    })
    const [result] = rankRecommendations(
      [
        {
          itemId: 'higher-urgency',
          dimensions: { impact: '20', urgency: '100', dataSufficiency: '0' },
        },
        {
          itemId: 'higher-impact',
          dimensions: { impact: '100', urgency: '20', dataSufficiency: '0' },
        },
      ],
      { weights: config.ranking.weights },
    )

    expect(result).toMatchObject({ itemId: 'higher-impact', score: '74' })
  })

  it.each([
    [
      'ranking weights',
      { ranking: { weights: { impact: '0.5' } } },
      'ranking weights must sum to 1',
    ],
    [
      'impact weights',
      { impact: { weights: { currentSpoilage: 90 } } },
      'weights must sum to 100',
    ],
    [
      'urgency thresholds',
      { urgency: { highUrgencyDays: 20 } },
      'urgency thresholds must ascend',
    ],
  ])(
    'rejects invalid %s with an actionable error',
    (_label, override, message) => {
      expect(() => parseMetricsConfig(override)).toThrow(message)
    },
  )

  it('rejects unknown keys instead of silently ignoring a typo', () => {
    expect(() =>
      parseMetricsConfig({ ranking: { weight: { impact: '1' } } }),
    ).toThrow('unknown key ranking.weight')
  })
})
