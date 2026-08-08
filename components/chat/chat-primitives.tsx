'use client'

import * as React from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type ChatMessageRole = 'assistant' | 'user'

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
