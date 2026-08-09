import * as React from 'react'

export const chartPatterns = [
  'solid',
  'hatch',
  'cross',
  'dots',
  'vertical',
] as const

export type ChartPattern = (typeof chartPatterns)[number]

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

const lineDashes = ['none', '8 6', '2 6', '10 5 2 5', '14 6'] as const

export function getChartEncoding(index: number) {
  if (index < 0 || index >= chartPatterns.length) {
    throw new RangeError('PantryIQ charts support at most five series.')
  }

  const pattern = chartPatterns[index]
  const color = chartColors[index]
  const dash = lineDashes[index]
  if (!pattern || !color || !dash) {
    throw new RangeError('PantryIQ charts support at most five series.')
  }

  return {
    color,
    pattern,
    dash,
  }
}

export type ChartSeries = {
  id: string
  label: string
}

export type RankedBarDatum = {
  label: string
  value: number
  valueLabel?: string
  seriesId?: string
}

type ChartFrameProps = {
  children: React.ReactNode
  ariaLabel: string
  width: number
}

function ChartFrame({ children, ariaLabel, width }: ChartFrameProps) {
  return (
    <div
      className="chart-scroll"
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="chart-canvas" style={{ width }}>
        {children}
      </div>
    </div>
  )
}

function PatternDefs({
  prefix,
  encodings,
}: {
  prefix: string
  encodings: readonly { color: string; pattern: ChartPattern }[]
}) {
  return (
    <defs>
      {encodings.map(({ color, pattern }, index) => {
        const id = `${prefix}-${pattern}-${index}`

        return (
          <pattern
            key={id}
            id={id}
            width={pattern === 'dots' ? 7 : 8}
            height={pattern === 'dots' ? 7 : 8}
            patternUnits="userSpaceOnUse"
          >
            <rect width="100%" height="100%" fill={color} />
            <PatternOverlay pattern={pattern} />
          </pattern>
        )
      })}
    </defs>
  )
}

function PatternOverlay({ pattern }: { pattern: ChartPattern }) {
  if (pattern === 'solid') return null

  const strokeWidth = pattern === 'dots' ? 0 : pattern === 'cross' ? 1.25 : 1.5
  const stroke = 'rgb(255 255 255 / 62%)'

  if (pattern === 'dots') {
    return <circle cx="2" cy="2" r="1.5" fill="rgb(255 255 255 / 75%)" />
  }

  if (pattern === 'vertical') {
    return <path d="M2 0V8M6 0V8" stroke={stroke} strokeWidth={strokeWidth} />
  }

  return (
    <>
      <path
        d="M-2 2L2-2M0 8L8 0M6 10L10 6"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {pattern === 'cross' && (
        <path
          d="M-2 6L2 10M0 0L8 8M6-2L10 2"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
    </>
  )
}

export function RankedBarChart({
  data,
  series = [{ id: 'default', label: 'Value' }],
  width = 720,
  ariaLabel = 'Ranked horizontal bar chart',
}: {
  data: readonly RankedBarDatum[]
  series?: readonly ChartSeries[]
  width?: number
  ariaLabel?: string
}) {
  if (series.length === 0 || series.length > chartPatterns.length) {
    throw new RangeError('PantryIQ charts require one to five series.')
  }

  const seriesById = new Map(series.map((entry, index) => [entry.id, index]))
  const sortedData = [...data].sort((a, b) => b.value - a.value)
  const minimumValue = Math.min(...sortedData.map(({ value }) => value), 0)
  const maximumValue = Math.max(...sortedData.map(({ value }) => value), 0)
  const chartWidth = Math.max(width, 560)
  const left = 184
  const right = 112
  const rowHeight = 56
  const top = 16
  const height = top + Math.max(sortedData.length, 1) * rowHeight + 16
  const plotWidth = chartWidth - left - right
  const valueRange = maximumValue - minimumValue || 1
  const zeroX = left + ((0 - minimumValue) / valueRange) * plotWidth

  return (
    <ChartFrame ariaLabel={ariaLabel} width={chartWidth}>
      <svg
        className="chart-svg"
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${chartWidth} ${height}`}
        width={chartWidth}
        height={height}
      >
        <title>{ariaLabel}</title>
        <PatternDefs
          prefix="bar"
          encodings={series.map((_, index) => getChartEncoding(index))}
        />
        {sortedData.length === 0 && (
          <text className="chart-empty" x={left} y={top + 24}>
            No data to show
          </text>
        )}
        {sortedData.map((datum, rowIndex) => {
          const seriesIndex = datum.seriesId
            ? seriesById.get(datum.seriesId)
            : 0
          if (seriesIndex === undefined) {
            throw new Error(`Unknown chart series: ${datum.seriesId}`)
          }

          const encoding = getChartEncoding(seriesIndex)
          const barY = top + rowIndex * rowHeight + 10
          const barWidth = (datum.value / valueRange) * plotWidth
          const visibleBarWidth = Math.max(Math.abs(barWidth), 1)
          const valueLabel = datum.valueLabel ?? String(datum.value)
          const seriesLabel = series[seriesIndex]?.label
          const barX = datum.value < 0 ? zeroX + barWidth : zeroX

          return (
            <g
              key={`${datum.label}-${rowIndex}`}
              aria-label={`${datum.label}: ${valueLabel}${seriesLabel ? `, ${seriesLabel}` : ''}`}
            >
              <text
                className="chart-label"
                x={left - 16}
                y={barY + 22}
                textAnchor="end"
              >
                {datum.label}
              </text>
              <rect
                className="chart-mark"
                x={barX}
                y={barY}
                width={visibleBarWidth}
                height={36}
                fill={`url(#bar-${encoding.pattern}-${seriesIndex})`}
                stroke="var(--foreground)"
                strokeOpacity=".18"
              />
              <text
                className="chart-value"
                x={datum.value < 0 ? barX - 8 : barX + visibleBarWidth + 8}
                y={barY + 23}
                textAnchor={datum.value < 0 ? 'end' : 'start'}
              >
                {valueLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </ChartFrame>
  )
}

export type LinePoint = {
  label: string
  value: number
  valueLabel?: string
}

export type LinePointOrGap = LinePoint | null

export type LineSeries = ChartSeries & {
  points: readonly LinePointOrGap[]
}

export function LineChart({
  series,
  width = 720,
  height = 280,
  ariaLabel = 'Line chart',
}: {
  series: readonly LineSeries[]
  width?: number
  height?: number
  ariaLabel?: string
}) {
  if (series.length === 0 || series.length > chartPatterns.length) {
    throw new RangeError('PantryIQ charts require one to five series.')
  }

  const left = 56
  const right = 136
  const top = 24
  const bottom = 48
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const pointsCount = Math.max(...series.map(({ points }) => points.length), 1)
  const values = series.flatMap(({ points }) =>
    points.flatMap((point) => (point ? [point.value] : [])),
  )
  const minimum = Math.min(...values, 0)
  const maximum = Math.max(...values, 1)
  const range = maximum - minimum || 1
  const xFor = (index: number) =>
    left +
    (pointsCount === 1
      ? plotWidth / 2
      : (index / (pointsCount - 1)) * plotWidth)
  const yFor = (value: number) => top + ((maximum - value) / range) * plotHeight

  return (
    <ChartFrame ariaLabel={ariaLabel} width={Math.max(width, 560)}>
      <svg
        className="chart-svg"
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
      >
        <title>{ariaLabel}</title>
        {series.map((entry, seriesIndex) => {
          const encoding = getChartEncoding(seriesIndex)
          const points = entry.points.map((point, pointIndex) =>
            point
              ? { ...point, x: xFor(pointIndex), y: yFor(point.value) }
              : null,
          )
          const segments: { x: number; y: number }[][] = []
          let currentSegment: { x: number; y: number }[] | undefined
          for (const point of points) {
            if (!point) {
              currentSegment = undefined
              continue
            }
            if (currentSegment) currentSegment.push(point)
            else {
              currentSegment = [point]
              segments.push(currentSegment)
            }
          }
          const lastPoint = [...points]
            .reverse()
            .find((point): point is NonNullable<typeof point> => point !== null)

          return (
            <g key={entry.id} aria-label={entry.label}>
              {segments.map((segment, segmentIndex) => (
                <polyline
                  key={`${entry.id}-segment-${segmentIndex}`}
                  className="chart-line"
                  points={segment.map(({ x, y }) => `${x},${y}`).join(' ')}
                  stroke={encoding.color}
                  strokeDasharray={encoding.dash}
                />
              ))}
              {entry.points.map((point, pointIndex) => {
                const position = points[pointIndex]
                if (!point || !position) return null

                return (
                  <g key={`${entry.id}-${point.label}`}>
                    <circle
                      className="chart-point"
                      cx={position.x}
                      cy={position.y}
                      r="4"
                      fill={encoding.color}
                      stroke="var(--card)"
                    />
                    <text
                      className="chart-value chart-point-value"
                      x={position.x}
                      y={position.y - 10}
                      textAnchor="middle"
                    >
                      {point.valueLabel ?? String(point.value)}
                    </text>
                  </g>
                )
              })}
              {lastPoint && (
                <text
                  className="chart-line-label"
                  x={lastPoint.x + 12}
                  y={lastPoint.y + 5}
                >
                  {entry.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </ChartFrame>
  )
}
