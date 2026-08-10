'use client'

import * as React from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { EvidenceTrace } from '@/src/server/metrics/evidence'

function hasCompleteTrace(
  trace: EvidenceTrace | null | undefined,
): trace is EvidenceTrace {
  return (
    Array.isArray(trace?.sources) &&
    trace.sources.length > 0 &&
    Array.isArray(trace.calculations) &&
    trace.calculations.length > 0 &&
    Array.isArray(trace.assumptions) &&
    trace.assumptions.length > 0
  )
}

function originLabel(origin: EvidenceTrace['assumptions'][number]['origin']) {
  if (origin === 'user-set') return 'Your value'
  if (origin === 'category-default') return 'Category suggestion'
  return 'PantryIQ default'
}

function calculationInputs(
  inputs: Record<string, string>,
  units: Record<string, string>,
) {
  return Object.entries(inputs)
    .map(([key, value]) => {
      const unit = key === 'unit' ? '' : (units[key] ?? '')
      return `${key} = ${value}${unit ? ` ${unit}` : ''}`
    })
    .join(' · ')
}

export function RecommendationWork({
  locationId,
  trace,
  defaultOpen = false,
  showEditLinks = true,
}: {
  locationId: string
  trace: EvidenceTrace | null | undefined
  defaultOpen?: boolean
  showEditLinks?: boolean
}) {
  if (!hasCompleteTrace(trace)) {
    return (
      <p className="recommendation-work__unverified" role="status">
        Output unverified. The evidence trace is incomplete.
      </p>
    )
  }

  return (
    <Collapsible className="recommendation-work" defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <Button
          className="recommendation-work__trigger"
          size="sm"
          variant="outline"
        >
          Show your work
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="recommendation-work__content">
        <div className="recommendation-work__section">
          <h3>Sources</h3>
          <ul className="recommendation-work__sources">
            {trace.sources.map((source) => (
              <li key={`${source.filename}-${source.uploadedAt}`}>
                <span>{source.filename}</span>{' '}
                <span className="figure">({source.rowCount} rows)</span>,
                uploaded{' '}
                <span className="figure">{source.uploadedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="recommendation-work__section">
          <h3>Calculations</h3>
          <ol className="recommendation-work__calculations">
            {trace.calculations.map((calculation) => (
              <li key={calculation.id}>
                <code>{calculation.operator}</code>
                <span className="figure">
                  {calculationInputs(calculation.inputs, calculation.units)}
                </span>
                <span>
                  Result:{' '}
                  <strong className="figure">
                    {calculation.result ?? 'Cannot calculate'}
                  </strong>
                  {calculation.result !== null
                    ? ` ${calculation.units.result ?? ''}`
                    : ''}
                </span>
                {calculation.explanation ? (
                  <span className="recommendation-work__note">
                    {calculation.explanation}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="recommendation-work__section">
          <h3>Assumptions</h3>
          <ul className="recommendation-work__assumptions">
            {trace.assumptions.map((assumption) => (
              <li key={assumption.name}>
                <span>
                  <strong>{assumption.name}</strong> ={' '}
                  <span className="figure">{assumption.value}</span>
                </span>
                <span>{originLabel(assumption.origin)}</span>
                {assumption.name.startsWith('item.') && showEditLinks ? (
                  <Link
                    href={`/settings?locationId=${encodeURIComponent(locationId)}#item-master`}
                  >
                    Edit in item settings
                  </Link>
                ) : assumption.name.startsWith('item.') ? (
                  <span className="recommendation-work__note">
                    Change in item settings
                  </span>
                ) : (
                  <span className="recommendation-work__note">
                    Change at {assumption.editPath}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
