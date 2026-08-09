'use client'

import * as React from 'react'
import { ArrowUp, Send } from 'lucide-react'

import {
  Bubble,
  ChatAnswer,
  Message,
  MessageScroller,
  type ChatMessageRole,
} from '@/components/chat/chat-primitives'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'
import {
  InputGroup,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'

type ChatMessage = {
  id: string
  role: ChatMessageRole
  content: string
  isStreaming?: boolean
}

const SUGGESTED_QUESTIONS = [
  'What is costing me the most right now?',
  'Which items should I watch this week?',
  'Why are my margins changing?',
]

export function ChatSurface({
  locationId,
  locationName,
  recommendations,
}: {
  locationId: string
  locationName: string
  recommendations: readonly RecommendationRecord[]
}) {
  const [draft, setDraft] = React.useState('')
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)

  function updateStreamingMessage(id: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, content } : message,
      ),
    )
  }

  async function submitQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isStreaming) return

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmedQuestion,
    }
    const assistantId = `${Date.now()}-assistant`
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft('')
    setIsStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        body: JSON.stringify({
          locationId,
          question: trimmedQuestion,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(
          payload?.error ?? 'The chat response could not be started.',
        )
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
        updateStreamingMessage(assistantId, content)
      }
      content += decoder.decode()
      updateStreamingMessage(assistantId, content)
    } catch (error) {
      updateStreamingMessage(
        assistantId,
        error instanceof Error
          ? error.message
          : 'The chat response could not be started.',
      )
    } finally {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, isStreaming: false }
            : message,
        ),
      )
      setIsStreaming(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion(draft)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <section
      className="chat-surface"
      data-location-id={locationId}
      aria-labelledby="chat-surface-title"
    >
      <div className="chat-surface__scope">
        <span className="chat-surface__scope-label">Chat scope</span>
        <strong id="chat-surface-title">{locationName}</strong>
        <span>Answers stay within this location.</span>
      </div>

      <MessageScroller>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div>
              <p className="chat-empty__eyebrow">Start with a question</p>
              <h2>What would you like to understand?</h2>
              <p>
                Ask about sales, purchasing, waste, or margin changes. The
                answer will show what the data supports.
              </p>
            </div>
            <div className="chat-suggestions" aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  className="chat-suggestion"
                  disabled={isStreaming}
                  key={question}
                  onClick={() => submitQuestion(question)}
                  type="button"
                >
                  <span>{question}</span>
                  <ArrowUp aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <Message key={message.id} role={message.role}>
              <Bubble
                isStreaming={message.isStreaming ?? false}
                role={message.role}
              >
                {message.role === 'assistant' ? (
                  <ChatAnswer
                    content={message.content}
                    isStreaming={message.isStreaming ?? false}
                    locationId={locationId}
                    recommendations={recommendations}
                  />
                ) : (
                  message.content || 'Preparing a response…'
                )}
              </Bubble>
            </Message>
          ))
        )}
      </MessageScroller>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-composer-input">
          Ask a question about {locationName}
        </label>
        <InputGroup className="chat-composer__group">
          <InputGroupTextarea
            aria-describedby="chat-composer-help"
            autoComplete="off"
            id="chat-composer-input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this location…"
            value={draft}
          />
          <InputGroupButton
            aria-label={isStreaming ? 'Waiting for response' : 'Send question'}
            className="chat-composer__send"
            disabled={isStreaming || !draft.trim()}
            size="icon-sm"
            type="submit"
          >
            <Send aria-hidden="true" />
          </InputGroupButton>
        </InputGroup>
        <p id="chat-composer-help" className="chat-composer__help">
          Enter sends. Shift+Enter adds a new line.
          {isStreaming ? ' Response is streaming.' : ''}
        </p>
      </form>
    </section>
  )
}
