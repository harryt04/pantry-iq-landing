import { describe, expect, it } from 'vitest'

import { ChatMissRegistry } from './misses'

describe('chat miss registry', () => {
  it('aggregates repeated questions and filters reports by account and location', () => {
    const registry = new ChatMissRegistry()
    const first = new Date('2026-08-08T10:00:00.000Z')

    registry.record({
      accountId: 'account-1',
      locationId: 'location-1',
      queryId: 'query-1',
      question: 'Did my supplier raise prices?',
      reason: 'outside-grounding',
      occurredAt: first,
    })
    registry.record({
      accountId: 'account-1',
      locationId: 'location-1',
      queryId: 'query-2',
      question: 'Did my supplier raise prices?',
      reason: 'outside-grounding',
      occurredAt: new Date('2026-08-08T11:00:00.000Z'),
    })
    registry.record({
      accountId: 'account-1',
      locationId: 'location-2',
      queryId: 'query-3',
      question: 'What is missing from my history?',
      reason: 'missing-data',
      occurredAt: new Date('2026-08-08T12:00:00.000Z'),
    })
    registry.record({
      accountId: 'account-2',
      locationId: 'location-3',
      queryId: 'query-4',
      question: 'Can I answer this?',
      reason: 'outside-grounding',
      occurredAt: new Date('2026-08-08T13:00:00.000Z'),
    })

    expect(registry.report('account-1', 'location-1')).toEqual({
      totalMisses: 2,
      questions: [
        {
          question: 'Did my supplier raise prices?',
          reason: 'outside-grounding',
          count: 2,
          lastSeenAt: '2026-08-08T11:00:00.000Z',
        },
      ],
    })
    expect(registry.report('account-1', 'location-2').totalMisses).toBe(1)
    expect(registry.report('account-2').totalMisses).toBe(1)
  })

  it('rejects blank questions and invalid timestamps', () => {
    const registry = new ChatMissRegistry()
    const base = {
      accountId: 'account-1',
      locationId: 'location-1',
      queryId: 'query-1',
      question: 'What cannot be answered?',
      reason: 'outside-grounding' as const,
      occurredAt: new Date('2026-08-08T10:00:00.000Z'),
    }

    expect(() => registry.record({ ...base, question: ' ' })).toThrow(
      'question must not be empty',
    )
    expect(() =>
      registry.record({ ...base, occurredAt: new Date('invalid') }),
    ).toThrow('occurredAt is invalid')
  })
})
