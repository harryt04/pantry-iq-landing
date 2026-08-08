'use client'

import * as React from 'react'
import { ArrowUp, Send } from 'lucide-react'

import {
  Bubble,
  Message,
  MessageScroller,
  type ChatMessageRole,
} from '@/components/chat/chat-primitives'
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

function stubbedReply(question: string) {
  return `Stubbed response: I received “${question}” for this location. The grounded answering service will use checked operational data here.`
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) =>
    window.setTimeout(resolve, milliseconds),
  )
}

async function streamStubbedReply(
  text: string,
  onUpdate: (content: string) => void,
) {
  let content = ''
  for (const word of text.split(' ')) {
    content = content ? `${content} ${word}` : word
    onUpdate(content)
    await wait(24)
  }
}

export function ChatSurface({
  locationId,
  locationName,
}: {
  locationId: string
  locationName: string
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

  function submitQuestion(question: string) {
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

    void streamStubbedReply(stubbedReply(trimmedQuestion), (content) => {
      updateStreamingMessage(assistantId, content)
    }).then(() => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, isStreaming: false }
            : message,
        ),
      )
      setIsStreaming(false)
    })
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
                {message.content || 'Preparing a response…'}
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
