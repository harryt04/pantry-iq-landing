export type ChatMissReason = 'outside-grounding' | 'missing-data'

export type ChatMiss = {
  accountId: string
  locationId: string
  queryId: string
  question: string
  reason: ChatMissReason
  occurredAt: Date
}

export type ChatMissSummary = {
  question: string
  reason: ChatMissReason
  count: number
  lastSeenAt: string
}

export type ChatMissReport = {
  totalMisses: number
  questions: ChatMissSummary[]
}

export interface ChatMissRecorder {
  record(miss: ChatMiss): void
}

function copyMiss(miss: ChatMiss): ChatMiss {
  return { ...miss, occurredAt: new Date(miss.occurredAt.getTime()) }
}

/**
 * In-process miss report until the persistent telemetry store is introduced.
 * The API exposes only the signed-in account's own questions.
 */
export class ChatMissRegistry implements ChatMissRecorder {
  private readonly misses: ChatMiss[] = []

  record(miss: ChatMiss): void {
    if (!miss.question.trim()) throw new Error('question must not be empty')
    if (Number.isNaN(miss.occurredAt.getTime()))
      throw new Error('occurredAt is invalid')

    this.misses.push(copyMiss(miss))
  }

  report(accountId: string, locationId?: string): ChatMissReport {
    const matching = this.misses.filter(
      (miss) =>
        miss.accountId === accountId &&
        (locationId === undefined || miss.locationId === locationId),
    )
    const grouped = new Map<string, ChatMissSummary>()

    for (const miss of matching) {
      const key = `${miss.reason}:${miss.question}`
      const current = grouped.get(key)
      if (current) {
        current.count += 1
        if (miss.occurredAt > new Date(current.lastSeenAt))
          current.lastSeenAt = miss.occurredAt.toISOString()
        continue
      }
      grouped.set(key, {
        question: miss.question,
        reason: miss.reason,
        count: 1,
        lastSeenAt: miss.occurredAt.toISOString(),
      })
    }

    return {
      totalMisses: matching.length,
      questions: [...grouped.values()].sort(
        (left, right) =>
          right.count - left.count ||
          right.lastSeenAt.localeCompare(left.lastSeenAt) ||
          left.question.localeCompare(right.question),
      ),
    }
  }
}

const globalScope = globalThis as typeof globalThis & {
  __pantryIqChatMisses?: ChatMissRegistry
}

export const chatMisses =
  globalScope.__pantryIqChatMisses ??
  (globalScope.__pantryIqChatMisses = new ChatMissRegistry())
