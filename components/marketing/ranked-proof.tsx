import * as React from 'react'

import {
  RankedBarChart,
  type ChartSeries,
} from '@/components/charts/chart-primitives'
import { recommendationSeverity } from '@/components/dashboard/recommendation-card'
import { marketingExample } from './marketing-example'

/**
 * Severity is not ordinal, so each series pins its own encoding rather than
 * taking the positional one. The pairs are the severity table in
 * `docs/brand/ui-implementation.md` §5.
 */
const severitySeries = [
  {
    id: 'steady',
    label: 'Steady',
    color: 'var(--signal-good)',
    pattern: 'solid',
  },
  {
    id: 'watch',
    label: 'Watch',
    color: 'var(--signal-watch)',
    pattern: 'hatch',
  },
  {
    id: 'risk',
    label: 'Act now',
    color: 'var(--signal-risk)',
    pattern: 'cross',
  },
] as const satisfies readonly ChartSeries[]

export function RankedProof() {
  const data = marketingExample.recommendations.map((recommendation) => ({
    label: recommendation.itemName,
    value: Number(recommendation.financialImpact.amount ?? 0),
    valueLabel: `$${recommendation.financialImpact.amount ?? '—'}`,
    seriesId: recommendationSeverity(recommendation.score),
  }))

  return (
    <div className="surface-proof__panel">
      <div className="surface-proof__panel-head">
        <span className="surface-proof__filename">
          Ranked by dollars at risk
        </span>
        <span className="surface-proof__chip surface-proof__chip--risk">
          <span aria-hidden="true">▲</span> 1 needs a decision
        </span>
      </div>
      <RankedBarChart
        ariaLabel="Dollars at risk by item, ranked, from the worked example"
        data={data}
        series={severitySeries}
        width={560}
      />
      <p className="surface-proof__note">
        Each row prints its own figure, and each bar carries a pattern as well
        as a colour, so the chart still reads in greyscale or in bad kitchen
        light.
      </p>
    </div>
  )
}
