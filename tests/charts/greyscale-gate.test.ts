import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  chartPatterns,
  getChartEncoding,
  LineChart,
  RankedBarChart,
} from '../../components/charts/chart-primitives'

const chartDirectory = join(process.cwd(), 'components/charts')

function chartSources() {
  return readdirSync(chartDirectory)
    .filter((filename) => /\.(ts|tsx)$/.test(filename))
    .filter((filename) => !filename.endsWith('.test.ts'))
    .map((filename) => readFileSync(join(chartDirectory, filename), 'utf8'))
}

function assertPatternFirstMarkup(markup: string) {
  const marks = [...markup.matchAll(/<rect[^>]*class="chart-mark"[^>]*>/g)]
  const lines = [...markup.matchAll(/<polyline[^>]*class="chart-line"[^>]*>/g)]

  if (
    marks.some(
      ([mark]) => !mark.includes('fill="url(#') || !mark.includes('stroke='),
    )
  ) {
    throw new Error('Every chart mark must use a pattern fill and a border.')
  }

  if (lines.some(([line]) => !line.includes('stroke-dasharray='))) {
    throw new Error('Every chart line must use a dash pattern.')
  }

  if (marks.length === 0 && lines.length === 0) {
    throw new Error('Every chart must expose a marked series.')
  }
}

describe('grayscale chart gate', () => {
  it('keeps the fixed five-pattern sequence and rejects a sixth series', () => {
    expect(chartPatterns).toEqual([
      'solid',
      'hatch',
      'cross',
      'dots',
      'vertical',
    ])
    expect(chartPatterns).toHaveLength(5)
    expect(() => getChartEncoding(chartPatterns.length)).toThrow(
      /at most five series/,
    )
  })

  it('rejects a colour-only chart mark', () => {
    expect(() =>
      assertPatternFirstMarkup(
        '<svg><rect class="chart-mark" fill="#0b5fa5" /></svg>',
      ),
    ).toThrow(/pattern fill/)
  })

  it('accepts every current chart primitive and its pattern encoding', () => {
    const bars = renderToStaticMarkup(
      React.createElement(RankedBarChart, {
        data: [
          { label: 'One', value: 2 },
          { label: 'Two', value: 1 },
        ],
      }),
    )
    const lines = renderToStaticMarkup(
      React.createElement(LineChart, {
        series: [
          {
            id: 'one',
            label: 'One',
            points: [
              { label: 'First', value: 1 },
              { label: 'Second', value: 2 },
            ],
          },
        ],
      }),
    )

    expect(() => assertPatternFirstMarkup(bars)).not.toThrow()
    expect(() => assertPatternFirstMarkup(lines)).not.toThrow()
  })

  it('contains no green colour value in any chart implementation', () => {
    const source = chartSources().join('\n').toLowerCase()

    expect(source).not.toMatch(/\bgreen\b/)
    expect(source).not.toMatch(/#(?:0f0|00ff00|008000)\b/)
    expect(source).not.toMatch(/rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)/)
  })
})
