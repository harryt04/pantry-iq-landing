import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import type { ContextBundle } from '@/src/server/metrics/context-bundle'
import type { RecommendationRecord } from '@/src/server/metrics/recommendations'

import {
  createNarrationService,
  getNarrationConfig,
  type NarrationConfig,
} from './narration'

const contextBundle = {
  version: 1,
  location: {
    id: 'location-1',
    name: 'Downtown',
    timezone: 'America/Denver',
    businessDayBoundary: '04:00:00',
    provenance: 'locations',
  },
  window: {
    start: '2026-07-01T00:00:00.000Z',
    end: '2026-08-01T00:00:00.000Z',
    provenance: 'normalized input rows',
  },
  items: [],
  categories: [],
  distributions: {
    dayOfWeek: [],
    timeOfDay: [],
    provenance: 'normalized transaction and purchase-order rows',
  },
  metrics: [],
  compaction: {
    omittedSeriesPoints: {
      value: '0',
      unit: 'series points',
      provenance: 'context-bundle compaction',
    },
    rule: 'oldest series points omitted first',
  },
} as ContextBundle

const recommendation = {
  version: 1,
  itemId: 'item-1',
  itemName: 'Salmon',
  rank: 1,
  score: '0.8',
  observation: {
    purchaseOrderCount: 3,
    quantityOrdered: '8',
    quantitySold: '2',
    sellThroughRate: '0.25',
    quantityOnHand: '4',
    unit: 'lb',
    scores: { impact: '0.8', urgency: '0.7', dataSufficiency: '0.6' },
  },
  financialImpact: {
    amount: '40',
    currency: 'USD',
    basis: 'currentSpoilage',
  },
  suggestedAction: {
    framing: 'consider',
    action: 'review-item',
    timeHorizon: 'this week',
  },
  dataFindings: [],
  evidenceTraceRef: {
    key: 'recommendation:item-1',
    itemId: 'item-1',
    inputWindowStart: '2026-07-01T00:00:00.000Z',
    inputWindowEnd: '2026-08-01T00:00:00.000Z',
  },
} as RecommendationRecord

const config: NarrationConfig = {
  provider: 'anthropic',
  model: 'test-haiku',
  timeoutMs: 500,
  maxRetries: 1,
  inputMicrosPerMillionTokens: 250_000n,
  outputMicrosPerMillionTokens: 1_250_000n,
}

function input() {
  return {
    accountId: 'account-1',
    queryId: 'query-1',
    question: 'What should I watch this week?',
    contextBundle,
    recommendations: [recommendation],
  }
}

function successfulModel() {
  return new MockLanguageModelV4({
    provider: 'anthropic.messages',
    modelId: 'test-haiku',
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Grounded answer.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop' as const,
            usage: {
              inputTokens: {
                total: 20,
                noCache: 10,
                cacheRead: 10,
                cacheWrite: 0,
              },
              outputTokens: {
                total: 4,
                text: 4,
                reasoning: 0,
              },
            },
          },
        ],
      }) as never,
    },
  })
}

async function readStream(stream: AsyncIterable<string>) {
  let text = ''
  for await (const chunk of stream) text += chunk
  return text
}

describe('narration service', () => {
  it('streams through the AI SDK and records exact usage, caching, and cost', async () => {
    const lines: string[] = []
    const model = successfulModel()
    const service = createNarrationService({
      config,
      model,
      now: () => 100,
      logger: {
        llmQueryCompleted: vi.fn((fields) =>
          lines.push(JSON.stringify(fields)),
        ),
      } as never,
    })

    const result = service.stream(input())
    await expect(readStream(result.textStream)).resolves.toBe(
      'Grounded answer.',
    )
    await expect(result.usage).resolves.toMatchObject({
      inputTokens: 20,
      outputTokens: 4,
      cacheReadTokens: 10,
      cacheHit: true,
      costMicros: 10,
      firstTokenMs: 0,
      degraded: false,
    })

    expect(model.doStreamCalls).toHaveLength(1)
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(
      'Precomputed recommendation records',
    )
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain(
      'Never calculate, add, subtract',
    )
    expect(lines[0]).toContain('"cacheHit":true')
  })

  it('retries a provider failure, then returns structured data without narration', async () => {
    const doStream = vi.fn(() => {
      throw new Error('provider unavailable')
    })
    const model = new MockLanguageModelV4({
      provider: 'anthropic.messages',
      modelId: 'test-haiku',
      doStream,
    })
    const service = createNarrationService({ config, model })

    const result = service.stream(input())
    const text = await readStream(result.textStream)
    const usage = await result.usage

    expect(doStream).toHaveBeenCalledTimes(2)
    expect(text).toContain('Narration is unavailable.')
    expect(text).toContain('Salmon')
    expect(usage).toMatchObject({ degraded: true, costMicros: 0 })
    expect(result.fallbackRecommendations).toEqual([recommendation])
  })

  it('uses safe defaults and rejects unknown providers', () => {
    expect(
      getNarrationConfig({
        NARRATION_INPUT_USD_PER_MILLION: '0.25',
        NARRATION_OUTPUT_USD_PER_MILLION: '1.25',
      }),
    ).toMatchObject({
      provider: 'anthropic',
      inputMicrosPerMillionTokens: 250_000n,
      outputMicrosPerMillionTokens: 1_250_000n,
    })

    expect(() =>
      getNarrationConfig({ NARRATION_PROVIDER: 'unsupported' }),
    ).toThrow('NARRATION_PROVIDER must be anthropic or openai')
  })
})
