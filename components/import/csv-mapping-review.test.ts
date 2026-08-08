import { describe, expect, it } from 'vitest'

import {
  getMappingReviewColumns,
  mappingReviewProgress,
} from './csv-mapping-review'

const mapping = {
  importType: 'transactions' as const,
  columns: [
    {
      sourceColumn: 'Date',
      sourceIndex: 0,
      targetField: 'transactedAt' as const,
      confidence: 100,
      band: 'auto' as const,
      evidence: [],
      candidates: [],
    },
    {
      sourceColumn: 'col_7',
      sourceIndex: 1,
      targetField: 'qty' as const,
      confidence: 64,
      band: 'review' as const,
      evidence: [],
      candidates: [],
    },
    {
      sourceColumn: 'Mystery',
      sourceIndex: 2,
      targetField: null,
      confidence: 0,
      band: 'unmapped' as const,
      evidence: [],
      candidates: [],
    },
  ],
  mapping: {
    Date: 'transactedAt' as const,
    col_7: 'qty' as const,
    Mystery: null,
  },
}

describe('CSV mapping review flow', () => {
  it('keeps auto-matched columns out of the one-at-a-time queue', () => {
    expect(
      getMappingReviewColumns(mapping).map((column) => column.sourceColumn),
    ).toEqual(['col_7', 'Mystery'])
  })

  it('counts only decisions explicitly reviewed by the operator', () => {
    const columns = getMappingReviewColumns(mapping)

    expect(mappingReviewProgress(columns, {})).toEqual({
      completed: 0,
      total: 2,
    })
    expect(mappingReviewProgress(columns, { 1: 'qty' })).toEqual({
      completed: 1,
      total: 2,
    })
    expect(mappingReviewProgress(columns, { 1: 'qty', 2: null })).toEqual({
      completed: 2,
      total: 2,
    })
  })
})
