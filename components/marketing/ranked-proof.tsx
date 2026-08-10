import * as React from 'react'

import {
  ChartLegend,
  RankedBarChart,
  type ChartSeries,
} from '@/components/charts/chart-primitives'
import {
  marketingExample,
  marketingMonthlyPurchases,
} from './marketing-example'

const itemSeries = marketingMonthlyPurchases.map(({ id, label }) => ({
  id,
  label,
})) satisfies readonly ChartSeries[]

export function RankedProof() {
  const data = marketingExample.recommendations.map((recommendation) => ({
    label: recommendation.itemName,
    value: Number(recommendation.financialImpact.amount ?? 0),
    valueLabel: `$${recommendation.financialImpact.amount ?? '—'}`,
    seriesId: recommendation.itemId,
  }))

  return (
    <div className="surface-proof__panel">
      <div className="surface-proof__purchase-scale">
        <div className="surface-proof__panel-head">
          <span className="surface-proof__filename">
            Monthly purchasing volume
          </span>
          <span className="surface-proof__chip">Four-week bad month</span>
        </div>
        <dl className="surface-proof__purchase-list">
          {marketingMonthlyPurchases.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <span
                className="surface-proof__purchase-leader"
                aria-hidden="true"
              />
              <dd className="figure">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="surface-proof__scale-note">
          These five categories total about{' '}
          <span className="figure">$55,200</span> in four weeks. The risk view
          below is current dollars at risk. It deliberately illustrates a bad
          month, with roughly <span className="figure">9–11%</span> of each
          category&apos;s buying volume still at risk. It is an illustration,
          not a forecast.
        </p>
      </div>
      <div className="surface-proof__panel-head">
        <span className="surface-proof__filename">
          Ranked by dollars at risk
        </span>
        <span className="surface-proof__chip surface-proof__chip--risk">
          <span aria-hidden="true">▲</span> 1 needs a decision
        </span>
      </div>
      <ChartLegend
        series={itemSeries}
        ariaLabel="Legend for dollars at risk by item"
      />
      <RankedBarChart
        ariaLabel="Dollars at risk by item, ranked, from the real-world example"
        data={data}
        series={itemSeries}
        width={560}
      />
      <p className="surface-proof__note">
        Each row prints its own figure, and each bar carries a pattern as well
        as a color, so the chart still reads in grayscale or in bad kitchen
        light.
      </p>
    </div>
  )
}
