import { describe, expect, it } from 'vitest'

import {
  detectReconciliationConflicts,
  shouldIncludeRecord,
} from './reconciliation'

const at = (value: string) => new Date(`${value}T12:00:00.000Z`)

describe('cross-source reconciliation', () => {
  it('deduplicates matching external IDs and keeps the provider copy', () => {
    const conflicts = detectReconciliationConflicts([
      {
        kind: 'transaction',
        source: 'csv',
        externalId: 'order-42',
        occurredAt: at('2026-08-01'),
      },
      {
        kind: 'transaction',
        source: 'square',
        externalId: 'order-42',
        occurredAt: at('2026-08-01'),
      },
    ])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      conflictType: 'external-id',
      status: 'resolved',
      authoritySource: 'square',
      sources: ['square', 'csv'],
    })
    expect(
      shouldIncludeRecord(
        {
          kind: 'transaction',
          source: 'csv',
          externalId: 'order-42',
          occurredAt: at('2026-08-01'),
        },
        conflicts,
      ),
    ).toBe(false)
    expect(
      shouldIncludeRecord(
        {
          kind: 'transaction',
          source: 'square',
          externalId: 'order-42',
          occurredAt: at('2026-08-01'),
        },
        conflicts,
      ),
    ).toBe(true)
  })

  it('leaves no-ID overlap out until an operator chooses an authority', () => {
    const conflicts = detectReconciliationConflicts([
      {
        kind: 'inventory',
        source: 'csv',
        externalId: null,
        occurredAt: at('2026-08-01'),
      },
      {
        kind: 'inventory',
        source: 'square',
        externalId: null,
        occurredAt: at('2026-08-01'),
      },
    ])
    const conflict = conflicts[0]
    if (!conflict) throw new Error('Expected an overlap conflict.')
    expect(conflict).toMatchObject({
      conflictType: 'period-overlap',
      status: 'unresolved',
      authoritySource: null,
    })
    expect(
      shouldIncludeRecord(
        {
          kind: 'inventory',
          source: 'csv',
          externalId: null,
          occurredAt: at('2026-08-01'),
        },
        conflicts,
      ),
    ).toBe(false)

    const resolved = [
      { ...conflict, status: 'resolved' as const, authoritySource: 'csv' },
    ]
    expect(
      shouldIncludeRecord(
        {
          kind: 'inventory',
          source: 'csv',
          externalId: null,
          occurredAt: at('2026-08-01'),
        },
        resolved,
      ),
    ).toBe(true)
    expect(
      shouldIncludeRecord(
        {
          kind: 'inventory',
          source: 'square',
          externalId: null,
          occurredAt: at('2026-08-01'),
        },
        resolved,
      ),
    ).toBe(false)
  })

  it('does not compare records from different canonical tables', () => {
    expect(
      detectReconciliationConflicts([
        {
          kind: 'transaction',
          source: 'csv',
          externalId: 'same-id',
          occurredAt: at('2026-08-01'),
        },
        {
          kind: 'purchase_order',
          source: 'square',
          externalId: 'same-id',
          occurredAt: at('2026-08-01'),
        },
      ]),
    ).toEqual([])
  })
})
