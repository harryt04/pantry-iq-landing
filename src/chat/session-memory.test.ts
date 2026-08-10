import { describe, expect, it } from 'vitest'

import {
  CHAT_HISTORY_TOKEN_BUDGET,
  estimateChatTokens,
  trimSessionHistory,
} from './session-memory'

function turn(role: 'user' | 'assistant', content: string) {
  return { role, content }
}

describe('chat session memory', () => {
  it('keeps the newest history within the 400-token allowance', () => {
    const history = [
      turn('user', 'old question '.repeat(100)),
      turn('assistant', 'old answer '.repeat(100)),
      turn('user', 'Tell me more about salmon.'),
    ]

    const result = trimSessionHistory(history)

    expect(result.trimmed).toBe(true)
    expect(result.history).toEqual([history[1], history[2]])
    expect(result.retainedTokens).toBeLessThanOrEqual(CHAT_HISTORY_TOKEN_BUDGET)
    expect(result.omittedMessages).toBe(1)
  })

  it('truncates an oversized newest message from the beginning', () => {
    const result = trimSessionHistory([
      turn('user', `${'a'.repeat(1_600)}latest`),
    ])

    expect(result.history).toHaveLength(1)
    expect(result.history[0]?.content.endsWith('latest')).toBe(true)
    expect(result.retainedTokens).toBeLessThanOrEqual(CHAT_HISTORY_TOKEN_BUDGET)
    expect(result.history[0]).not.toEqual(
      turn('user', `${'a'.repeat(1_600)}latest`),
    )
  })

  it('does not report a trim when all turns fit', () => {
    const history = [turn('user', 'What changed?')]
    const result = trimSessionHistory(history)

    expect(result).toMatchObject({
      history,
      originalTokens: estimateChatTokens(history[0]!),
      retainedTokens: estimateChatTokens(history[0]!),
      omittedMessages: 0,
      trimmed: false,
    })
  })

  it('can start a new empty session', () => {
    expect(trimSessionHistory([])).toEqual({
      history: [],
      originalTokens: 0,
      retainedTokens: 0,
      omittedMessages: 0,
      trimmed: false,
    })
  })
})
