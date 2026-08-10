'use client'

import * as React from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { RecommendationWork } from '@/components/dashboard/recommendation-work'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

export type ChatMessageRole = 'assistant' | 'user'

type ChatRecommendation = RecommendationRecord & {
  locationId?: string
  locationName?: string
}

export function Message({
  role,
  children,
}: {
  role: ChatMessageRole
  children: React.ReactNode
}) {
  return (
    <article
      aria-label={role === 'assistant' ? 'PantryIQ message' : 'Your message'}
      className={cn('chat-message', role === 'user' && 'chat-message--user')}
    >
      <div className="chat-message__identity">
        {role === 'assistant' ? 'PantryIQ' : 'You'}
      </div>
      {children}
    </article>
  )
}

export function Bubble({
  role,
  children,
  isStreaming = false,
}: {
  role: ChatMessageRole
  children: React.ReactNode
  isStreaming?: boolean
}) {
  return (
    <div
      className={cn(
        'chat-bubble',
        role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant',
        isStreaming && 'chat-bubble--streaming',
      )}
    >
      {children}
    </div>
  )
}

export function MessageScroller({ children }: { children: React.ReactNode }) {
  return (
    <ScrollArea className="chat-transcript" aria-label="Chat transcript">
      <div aria-live="polite" className="chat-transcript__messages">
        {children}
      </div>
    </ScrollArea>
  )
}

const ANSWER_PARTS = [
  'Observation',
  'Financial impact',
  'Prediction',
  'Recommendation',
  'Show your work',
] as const

export type ChatAnswerPart = {
  label: (typeof ANSWER_PARTS)[number]
  content: string
}

/** Parses the validated five-part answer without duplicating its server contract. */
export function parseChatAnswer(text: string): ChatAnswerPart[] | null {
  const pattern =
    /(?:^|\n)\s*\**(Observation|Financial impact|Prediction|Recommendation|Show your work)\**\s*:\s*/gi
  const matches = [...text.matchAll(pattern)]
  if (matches.length !== ANSWER_PARTS.length) return null

  const parts = matches.map((match, index) => {
    const label = match[1]
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    return {
      label: label as ChatAnswerPart['label'],
      content: text.slice(start, end).trim(),
    }
  })

  return parts.every((part, index) => part.label === ANSWER_PARTS[index])
    ? parts
    : null
}

function matchingRecommendations(
  text: string,
  recommendations: readonly ChatRecommendation[],
) {
  const normalized = text.toLocaleLowerCase()
  return recommendations.filter((recommendation) => {
    const itemName = recommendation.itemName.trim().toLocaleLowerCase()
    return itemName.length > 0 && normalized.includes(itemName)
  })
}

export function ChatAnswer({
  content,
  isStreaming = false,
  locationId,
  recommendations,
}: {
  content: string
  isStreaming?: boolean
  locationId: string
  recommendations: readonly ChatRecommendation[]
}) {
  const parts = isStreaming ? null : parseChatAnswer(content)
  if (!parts) return <>{content || 'Preparing a response.'}</>

  const matched = matchingRecommendations(content, recommendations)

  return (
    <div className="chat-answer">
      {parts.map((part) => (
        <section className="chat-answer__part" key={part.label}>
          <h3>{part.label}</h3>
          <p>{part.content}</p>
        </section>
      ))}
      <div className="chat-answer__evidence" aria-label="Chat evidence">
        {matched.length > 0 ? (
          matched.map((recommendation) => (
            <RecommendationWork
              key={recommendation.evidenceTraceRef.key}
              locationId={recommendation.locationId ?? locationId}
              trace={recommendation.evidenceTrace}
            />
          ))
        ) : (
          <p className="recommendation-work__unverified" role="status">
            Output unverified. This answer has no matching evidence trace.
          </p>
        )}
      </div>
    </div>
  )
}
