import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  chartPatterns,
  getChartEncoding,
  LineChart,
  RankedBarChart,
} from './chart-primitives'

const series = chartPatterns.map((pattern, index) => ({
  id: pattern,
  label: `Series ${index + 1}`,
}))

describe('pattern-first chart primitives', () => {
  it('assigns the fixed pattern and colour sequence without green', () => {
    expect(series.map((_, index) => getChartEncoding(index).pattern)).toEqual([
      'solid',
      'hatch',
      'cross',
      'dots',
      'vertical',
    ])
    expect(series.map((_, index) => getChartEncoding(index).color)).toEqual([
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)',
      'var(--chart-5)',
    ])
    expect(JSON.stringify(series).toLowerCase()).not.toContain('green')
    expect(() => getChartEncoding(5)).toThrow(/at most five series/)
  })

  it('prints every ranked mark and keeps the scroll boundary on the chart', () => {
    const markup = renderToStaticMarkup(
      React.createElement(RankedBarChart, {
        data: series.map((entry, index) => ({
          label: entry.label,
          seriesId: entry.id,
          value: 100 - index * 10,
          valueLabel: `${100 - index * 10}%`,
        })),
        series,
        ariaLabel: 'Five series by week',
      }),
    )

    expect(markup).toContain('class="chart-scroll"')
    expect(markup).toContain('aria-label="Five series by week"')
    expect(markup).toContain('bar-solid-0')
    expect(markup).toContain('bar-hatch-1')
    expect(markup).toContain('bar-cross-2')
    expect(markup).toContain('bar-dots-3')
    expect(markup).toContain('bar-vertical-4')
    expect(markup.match(/>100%<|>90%<|>80%<|>70%<|>60%</g)).toHaveLength(5)
  })

  it('uses dash patterns, point values, and end labels for lines', () => {
    const markup = renderToStaticMarkup(
      React.createElement(LineChart, {
        series: series.map((entry, seriesIndex) => ({
          ...entry,
          points: [
            {
              label: 'Week 1',
              value: 10 + seriesIndex,
              valueLabel: `${10 + seriesIndex}`,
            },
            {
              label: 'Week 2',
              value: 12 + seriesIndex,
              valueLabel: `${12 + seriesIndex}`,
            },
          ],
        })),
        ariaLabel: 'Patterned trend lines',
      }),
    )

    expect(markup).toContain('stroke-dasharray="none"')
    expect(markup).toContain('stroke-dasharray="8 6"')
    expect(markup).toContain('stroke-dasharray="2 6"')
    expect(markup).toContain('stroke-dasharray="10 5 2 5"')
    expect(markup).toContain('stroke-dasharray="14 6"')
    expect(markup).toContain('Series 5')
    for (const value of [10, 11, 12, 13, 14, 15, 16]) {
      expect(markup).toContain(`>${value}<`)
    }
  })

  it('renders missing line periods as gaps', () => {
    const markup = renderToStaticMarkup(
      React.createElement(LineChart, {
        series: [
          {
            id: 'margin',
            label: 'Margin',
            points: [
              { label: 'Week 1', value: 10 },
              null,
              { label: 'Week 3', value: 12 },
            ],
          },
        ],
      }),
    )

    expect(markup.match(/class="chart-line"/g)).toHaveLength(2)
    expect(markup.match(/class="chart-point"/g)).toHaveLength(2)
    expect(markup).not.toContain('>11<')
  })
})
