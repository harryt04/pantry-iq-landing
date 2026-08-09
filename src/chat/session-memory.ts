export type SessionChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

/** The history allowance from the query-size assumptions in cost-and-pricing.md. */
export const CHAT_HISTORY_TOKEN_BUDGET = 400
export const CHAT_HISTORY_MAX_MESSAGES = 24
const CHARS_PER_ESTIMATED_TOKEN = 4

export type TrimmedSessionHistory = {
  history: SessionChatTurn[]
  originalTokens: number
  retainedTokens: number
  omittedMessages: number
  trimmed: boolean
}

export function estimateChatTokens(turn: SessionChatTurn) {
  return Math.ceil(turn.content.length / CHARS_PER_ESTIMATED_TOKEN)
}

/**
 * Keeps the newest conversation context within the fixed prompt budget.
 * Older messages are dropped first; an oversized newest message is kept from
 * its end so the most recent context remains available.
 */
export function trimSessionHistory(
  input: readonly SessionChatTurn[],
  budgetTokens = CHAT_HISTORY_TOKEN_BUDGET,
): TrimmedSessionHistory {
  const originalTokens = input.reduce(
    (total, turn) => total + estimateChatTokens(turn),
    0,
  )
  let remaining = Math.max(0, budgetTokens)
  const retained: SessionChatTurn[] = []
  let omittedMessages = 0

  for (let index = input.length - 1; index >= 0; index -= 1) {
    const turn = input[index]
    if (!turn) continue
    const tokens = estimateChatTokens(turn)

    if (tokens <= remaining) {
      retained.push(turn)
      remaining -= tokens
      continue
    }

    if (remaining > 0 && retained.length === 0 && turn.content.length > 0) {
      const maxCharacters = remaining * CHARS_PER_ESTIMATED_TOKEN
      const content = turn.content.slice(-maxCharacters)
      retained.push({ ...turn, content })
      remaining = 0
    }
    omittedMessages += 1
  }

  retained.reverse()
  const retainedTokens = retained.reduce(
    (total, turn) => total + estimateChatTokens(turn),
    0,
  )

  return {
    history: retained,
    originalTokens,
    retainedTokens,
    omittedMessages,
    trimmed:
      retained.length !== input.length ||
      retained.some((turn, index) => turn !== input[index]),
  }
}
