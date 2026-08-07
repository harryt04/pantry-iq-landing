import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { conversations, locations, messages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { streamText, type ModelMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { getModel } from '@/lib/ai/models'
import { buildPromptWithContext } from '@/lib/ai/prompts'
import { buildContextData } from '@/lib/ai/context-builder'
import {
  persistUserMessage,
  persistStreamedMessage,
} from '@/lib/ai/stream-handler'

// POST /api/conversations/[id]/message - Send a message and stream response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: conversationId } = await params

    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 },
      )
    }

    // Verify conversation exists and belongs to user's location
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      )
    }

    const location = await db
      .select()
      .from(locations)
      .where(eq(locations.id, conversation[0].locationId))

    if (location.length === 0 || location[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Persist user message
    await persistUserMessage(conversationId, message)

    // Build context data
    const contextData = await buildContextData(conversation[0].locationId)

    // Get system prompt with context
    const systemPrompt = buildPromptWithContext(contextData)

    // Get conversation history for context
    const conversationHistory = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))

    // Get model
    const modelConfig = getModel(conversation[0].defaultModel)

    // Get the appropriate model instance
    let model: LanguageModelV3
    switch (modelConfig.provider) {
      case 'openai':
        if (!process.env.OPENAI_API_KEY) {
          return NextResponse.json(
            { error: 'OpenAI provider not available' },
            { status: 503 },
          )
        }
        model = openai(modelConfig.id)
        break
      case 'anthropic':
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json(
            { error: 'Anthropic provider not available' },
            { status: 503 },
          )
        }
        model = anthropic(modelConfig.id)
        break
      case 'google':
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          return NextResponse.json(
            { error: 'Google provider not available' },
            { status: 503 },
          )
        }
        model = google(modelConfig.id)
        break
      default:
        return NextResponse.json({ error: 'Unknown provider' }, { status: 500 })
    }

    // Convert conversation history to AI SDK format
    const messageHistory = conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })) as ModelMessage[]

    // Create the stream
    const result = streamText({
      model,
      system: systemPrompt,
      // The user message was persisted before history was loaded, so adding it
      // again here would send the current turn to the model twice.
      messages: messageHistory,
      temperature: 0.7,
    })

    // Collect full content for persistence
    let fullContent = ''

    // Create a custom ReadableStream that handles both streaming and persistence
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const { textStream, usage } = await result

          // Stream text chunks to client
          for await (const chunk of textStream) {
            fullContent += chunk
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'content', delta: chunk })}\n\n`,
              ),
            )
          }

          // Get final usage stats
          const finalUsage = await usage

          // Extract token counts - handle different possible property names
          interface UsageData {
            input?: number
            inputTokens?: number
            output?: number
            outputTokens?: number
          }
          const usageData = finalUsage as UsageData
          const tokensIn = usageData.input || usageData.inputTokens || 0
          const tokensOut = usageData.output || usageData.outputTokens || 0

          // Persist the complete message
          await persistStreamedMessage({
            conversationId,
            role: 'assistant',
            content: fullContent,
            modelUsed: modelConfig.id,
            tokensIn,
            tokensOut,
          })

          // Send completion event
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: 'complete',
                tokensIn,
                tokensOut,
              })}\n\n`,
            ),
          )

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in message handler:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 },
    )
  }
}
