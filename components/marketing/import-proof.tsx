import * as React from 'react'

import { marketingMapping } from './marketing-example'
import { canonicalFieldLabels } from '@/src/server/csv/mapping'

/**
 * Step one, shown rather than described. Every row here is the output of the
 * product's own column detector running on a sales export with the header
 * names a POS really produces.
 */
export function ImportProof() {
  return (
    <div className="surface-proof__panel">
      <div className="surface-proof__panel-head">
        <span className="surface-proof__filename figure">sales-export.csv</span>
        <span className="surface-proof__chip surface-proof__chip--good">
          <span aria-hidden="true">●</span> Read, no setup
        </span>
      </div>
      <ul className="mapping-proof">
        {marketingMapping.columns.map((column) => (
          <li className="mapping-proof__row" key={column.sourceColumn}>
            <span className="mapping-proof__source figure">
              {column.sourceColumn}
            </span>
            <span aria-hidden="true" className="mapping-proof__arrow">
              →
            </span>
            <span className="mapping-proof__target">
              <span className="mapping-proof__field">
                {column.targetField
                  ? canonicalFieldLabels[column.targetField]
                  : 'Not used'}
              </span>
              <span className="mapping-proof__evidence">
                {column.evidence.join(' ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="surface-proof__note">
        Every column is yours to confirm or change before anything is saved.
      </p>
    </div>
  )
}
