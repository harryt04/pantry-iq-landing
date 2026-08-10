import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { buildLocationComparison } from '@/src/server/metrics/location-comparison'
import { LocationComparisonView } from './location-comparison'

describe('location comparison view', () => {
  it('prints location values, coverage warnings, and patterned chart marks', () => {
    const comparison = buildLocationComparison([
      {
        locationId: 'north',
        locationName: 'North',
        period: {
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-08-01T00:00:00.000Z',
        },
        dataSufficiency: { status: 'calculated', value: '90' },
        metrics: {
          spoilageRate: '25',
          margin: '84.125',
          sellThrough: '75',
          moneyAtRisk: '12.50',
        },
      },
      {
        locationId: 'south',
        locationName: 'South',
        period: {
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-08-01T00:00:00.000Z',
        },
        dataSufficiency: { status: 'calculated', value: '65' },
        metrics: {
          spoilageRate: '50',
          margin: '-2',
          sellThrough: '50',
          moneyAtRisk: null,
        },
      },
    ])

    const markup = renderToStaticMarkup(
      React.createElement(LocationComparisonView, { comparison }),
    )

    expect(markup).toContain('Data coverage differs across locations.')
    expect(markup).toContain('North: Data sufficiency 90/100')
    expect(markup).toContain('South: Data sufficiency 65/100')
    expect(markup).toContain('25%')
    expect(markup).toContain('$84.125')
    expect(markup).toContain('url(#bar-solid-0)')
    expect(markup).toContain('Not available')
  })

  it('renders no chart when the metric periods differ', () => {
    const comparison = buildLocationComparison([
      {
        locationId: 'north',
        locationName: 'North',
        period: {
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-08-01T00:00:00.000Z',
        },
        dataSufficiency: { status: 'calculated', value: '90' },
        metrics: {
          spoilageRate: '25',
          margin: '84.125',
          sellThrough: '75',
          moneyAtRisk: '12.50',
        },
      },
      {
        locationId: 'south',
        locationName: 'South',
        period: {
          start: '2026-07-02T00:00:00.000Z',
          end: '2026-08-02T00:00:00.000Z',
        },
        dataSufficiency: { status: 'calculated', value: '90' },
        metrics: {
          spoilageRate: '50',
          margin: '10',
          sellThrough: '50',
          moneyAtRisk: '9',
        },
      },
    ])

    const markup = renderToStaticMarkup(
      React.createElement(LocationComparisonView, { comparison }),
    )

    expect(markup).toContain('Locations cover different periods')
    expect(markup).toContain('Period differs')
    expect(markup).not.toContain('chart-svg')
  })
})
