import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HistoryDetails, type HistoryEntry, typeLabel } from './import-history'

const entry: HistoryEntry = {
  id: 'import-1',
  filename: 'sales.csv',
  importType: 'transactions',
  rowsImported: 12,
  status: 'imported',
  uploadedAt: '2026-08-08T12:00:00.000Z',
  mappingUsed: {
    Date: 'transactedAt',
    Item: 'rawItemName',
    Quantity: 'qty',
    Notes: null,
  },
  itemResolution: {
    created: [
      { id: 'item-new', canonicalName: 'salmon', displayName: 'Salmon' },
    ],
    matched: [
      { id: 'item-existing', canonicalName: 'potato', displayName: 'Potato' },
    ],
  },
}

describe('import history drill-down', () => {
  it('renders the mapping and separates created items from matches', () => {
    const markup = renderToStaticMarkup(<HistoryDetails entry={entry} />)

    expect(markup).toContain('Column mapping used')
    expect(markup).toContain('Transaction date and time')
    expect(markup).toContain('Skipped')
    expect(markup).toContain('Items created')
    expect(markup).toContain('Salmon')
    expect(markup).toContain('Items matched')
    expect(markup).toContain('Potato')
    expect(markup).not.toContain('Delete')
  })

  it('labels manual entries by their durable entry type', () => {
    expect(
      typeLabel({
        ...entry,
        importType: 'manual',
        mappingUsed: { source: 'manual', entryType: 'purchase_order' },
      }),
    ).toBe('Purchase order')
  })
})
