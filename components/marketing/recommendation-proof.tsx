import * as React from 'react'

import { marketingExample } from './marketing-example'
import { assumptionOriginLabel, marketingWork } from './marketing-evidence'
import { RecommendationCard } from '@/components/dashboard/recommendation-card'

const proofRecommendation = (() => {
  const recommendation = marketingExample.recommendations[0]
  if (!recommendation) {
    throw new Error(
      'The marketing proof recommendation could not be assembled.',
    )
  }
  return recommendation
})()

const proofWork = (() => {
  const work = marketingWork(proofRecommendation)
  if (!work) {
    throw new Error('The marketing proof arithmetic could not be assembled.')
  }
  return work
})()

/**
 * Step three: the shipped recommendation card, followed by a receipt for the
 * one figure the card leads with.
 *
 * The card renders with its own "Show your work" collapsed. The full engine
 * trace belongs in the product; what a stranger needs is the three lines of
 * arithmetic that produce $240. See `marketing-evidence.ts`.
 */
export function RecommendationProof() {
  return (
    <div className="surface-proof__panel surface-proof__panel--plain">
      <RecommendationCard
        locationId="marketing-proof"
        recommendation={proofRecommendation}
        variant="marketing"
      />

      <div className="work-receipt">
        <h3 className="work-receipt__title">Where the figure comes from</h3>
        <dl className="work-receipt__lines">
          {proofWork.terms.map((term) => (
            <div className="work-receipt__line" key={term.label}>
              <dt>{term.label}</dt>
              <dd className="figure">{term.value}</dd>
            </div>
          ))}
          <div className="work-receipt__line work-receipt__line--total">
            <dt>{proofWork.resultLabel}</dt>
            <dd className="figure">{proofWork.result}</dd>
          </div>
        </dl>
        <h3 className="work-receipt__title">Read from</h3>
        <ul className="work-receipt__sources">
          {proofWork.sources.map((source) => (
            <li key={source.filename}>
              <span className="figure">{source.filename}</span>
              <span className="work-receipt__rows figure">
                {source.rowCount} rows
              </span>
            </li>
          ))}
        </ul>

        <h3 className="work-receipt__title">What we assumed</h3>
        <ul className="work-receipt__assumptions">
          {proofWork.assumptions.map((assumption) => (
            <li key={assumption.name}>
              <span>
                Shelf life: <span className="figure">{assumption.value}</span>{' '}
                days
              </span>
              <span className="work-receipt__origin">
                {assumptionOriginLabel(assumption.origin)} · change it at{' '}
                {assumption.editPath}
              </span>
            </li>
          ))}
        </ul>
        <p className="work-receipt__foot">
          Every assumption is labeled with where it came from, and every one is
          yours to change. Change the shelf life and the figure changes with it.
        </p>
      </div>
    </div>
  )
}
