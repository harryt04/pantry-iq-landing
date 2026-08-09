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
import type {
  AssumptionComparison,
  AssumptionField,
  NormalizedAssumptionOverride,
} from '@/src/server/chat/assumption-override'
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

function figureLabel(value: string | null, prefix = '') {
  return value === null ? 'not available' : `${prefix}${value}`
}

function fieldLabel(field: AssumptionField) {
  return field === 'shelfLifeDays' ? 'Shelf life (days)' : 'Cost per unit'
}

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
  const [overrides, setOverrides] = React.useState<
    NormalizedAssumptionOverride[]
  >([])
  const [overrideItemId, setOverrideItemId] = React.useState(
    recommendations[0]?.itemId ?? '',
  )
  const [overrideField, setOverrideField] =
    React.useState<AssumptionField>('shelfLifeDays')
  const [overrideValue, setOverrideValue] = React.useState('')
  const [comparison, setComparison] =
    React.useState<AssumptionComparison | null>(null)
  const [overrideStatus, setOverrideStatus] = React.useState<string | null>(
    null,
  )
  const [isComparing, setIsComparing] = React.useState(false)
  const [isSavingOverride, setIsSavingOverride] = React.useState(false)

  React.useEffect(() => {
    setMessages([])
    setDraft('')
    setOverrides([])
    setComparison(null)
    setOverrideStatus(null)
  }, [locationId])

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
          overrides,
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

  async function compareOverride(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!overrideItemId || !overrideValue.trim() || isComparing) return
    setIsComparing(true)
    setOverrideStatus(null)
    try {
      const response = await fetch('/api/chat/override', {
        body: JSON.stringify({
          field: overrideField,
          itemId: overrideItemId,
          locationId,
          value: overrideValue.trim(),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as {
        comparison?: AssumptionComparison
        override?: NormalizedAssumptionOverride
        error?: string
      } | null
      if (!response.ok || !payload?.comparison || !payload.override) {
        throw new Error(
          payload?.error ?? 'The assumption could not be recalculated.',
        )
      }
      setComparison(payload.comparison)
      setOverrideStatus(
        'How should PantryIQ use this change? Nothing has been saved yet.',
      )
    } catch (error) {
      setOverrideStatus(
        error instanceof Error
          ? error.message
          : 'The assumption could not be recalculated.',
      )
    } finally {
      setIsComparing(false)
    }
  }

  function useForConversation() {
    if (!comparison) return
    setOverrides((current) => [
      ...current.filter(
        (override) =>
          !(
            override.itemId === comparison.itemId &&
            override.field === comparison.field
          ),
      ),
      {
        itemId: comparison.itemId,
        field: comparison.field,
        value: comparison.afterValue,
      },
    ])
    setOverrideStatus(
      `${comparison.itemName} uses ${fieldLabel(comparison.field).toLocaleLowerCase()} ${comparison.afterValue} for this conversation.`,
    )
  }

  async function saveToSettings() {
    if (!comparison || isSavingOverride) return
    setIsSavingOverride(true)
    setOverrideStatus(null)
    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(comparison.itemId)}?locationId=${encodeURIComponent(locationId)}`,
        {
          body: JSON.stringify({
            [comparison.field]: comparison.afterValue,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      )
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      if (!response.ok) {
        throw new Error(
          payload?.error ?? 'The item setting could not be saved.',
        )
      }
      useForConversation()
      setOverrideStatus(
        `${comparison.itemName} is saved to item settings and applied to this conversation.`,
      )
    } catch (error) {
      setOverrideStatus(
        error instanceof Error
          ? error.message
          : 'The item setting could not be saved.',
      )
    } finally {
      setIsSavingOverride(false)
    }
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

      <details className="chat-override">
        <summary>Question an assumption</summary>
        <div className="chat-override__body">
          <p>
            Choose a shelf life or cost, and PantryIQ will recalculate the
            recommendation before asking where to apply it.
          </p>
          {recommendations.length === 0 ? (
            <p className="chat-override__status" role="status">
              There is no ranked item to adjust yet.
            </p>
          ) : (
            <form className="chat-override__form" onSubmit={compareOverride}>
              <label htmlFor="chat-override-item">Item</label>
              <select
                id="chat-override-item"
                onChange={(event) => setOverrideItemId(event.target.value)}
                value={overrideItemId}
              >
                {recommendations.map((recommendation) => (
                  <option
                    key={recommendation.itemId}
                    value={recommendation.itemId}
                  >
                    {recommendation.itemName}
                  </option>
                ))}
              </select>
              <label htmlFor="chat-override-field">Assumption</label>
              <select
                id="chat-override-field"
                onChange={(event) =>
                  setOverrideField(event.target.value as AssumptionField)
                }
                value={overrideField}
              >
                <option value="shelfLifeDays">Shelf life (days)</option>
                <option value="costPerUnit">Cost per unit</option>
              </select>
              <label htmlFor="chat-override-value">
                New {fieldLabel(overrideField).toLocaleLowerCase()}
              </label>
              <input
                id="chat-override-value"
                inputMode={
                  overrideField === 'shelfLifeDays' ? 'numeric' : 'decimal'
                }
                min="0"
                onChange={(event) => setOverrideValue(event.target.value)}
                required
                step={overrideField === 'shelfLifeDays' ? '1' : '0.01'}
                type="number"
                value={overrideValue}
              />
              <button disabled={isComparing} type="submit">
                {isComparing ? 'Recalculating…' : 'Recalculate'}
              </button>
            </form>
          )}
          {comparison ? (
            <div className="chat-override__comparison" aria-live="polite">
              <h3>{comparison.itemName}</h3>
              <p>
                {fieldLabel(comparison.field)}:{' '}
                {comparison.beforeValue ?? 'not set'} → {comparison.afterValue}
              </p>
              <dl>
                <div>
                  <dt>Financial impact</dt>
                  <dd>
                    {figureLabel(comparison.before.financialImpact, '$')} →{' '}
                    {figureLabel(comparison.after.financialImpact, '$')}
                  </dd>
                </div>
                <div>
                  <dt>Recommendation score</dt>
                  <dd>
                    {figureLabel(comparison.before.recommendationScore)} →{' '}
                    {figureLabel(comparison.after.recommendationScore)}
                  </dd>
                </div>
                <div>
                  <dt>Urgency score</dt>
                  <dd>
                    {figureLabel(comparison.before.urgencyScore)} →{' '}
                    {figureLabel(comparison.after.urgencyScore)}
                  </dd>
                </div>
              </dl>
              <p className="chat-override__status" role="status">
                {overrideStatus}
              </p>
              <div className="chat-override__actions">
                <button onClick={useForConversation} type="button">
                  This conversation only
                </button>
                <button
                  disabled={isSavingOverride}
                  onClick={saveToSettings}
                  type="button"
                >
                  {isSavingOverride ? 'Saving…' : 'Save to item settings'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  )
}
