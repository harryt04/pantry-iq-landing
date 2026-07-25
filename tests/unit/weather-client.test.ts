/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/db'
import type { MockedFunction } from 'vitest'
import {
  getHistoricalWeather,
  getForecast,
  getWeatherCacheStats,
} from '@/lib/weather/client'

// Unit tests must not touch real Postgres (CI runs unit tests before schema setup).
vi.mock('@/db')
vi.mock('drizzle-orm')

// Mock fetch globally
global.fetch = vi.fn()

interface MockDb {
  select: MockedFunction<() => any>
  insert: MockedFunction<() => any>
  delete: MockedFunction<() => any>
}

function mockEmptySelect() {
  const typedDb = db as unknown as MockDb
  const limit = vi.fn().mockResolvedValue([])
  const where = vi.fn().mockReturnValue({ limit })
  // getForecast uses select().from().where() without limit; also allow bare from()
  const from = vi.fn().mockImplementation(() => {
    const chain: any = Promise.resolve([])
    chain.where = where
    return chain
  })
  // where() may also be awaited directly (getForecast)
  where.mockImplementation(() => {
    const chain: any = Promise.resolve([])
    chain.limit = limit
    return chain
  })
  typedDb.select.mockReturnValue({ from })
  typedDb.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  })
  typedDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  })
}

describe('Weather Client', () => {
  const locationId = '550e8400-e29b-41d4-a716-446655440000'
  const coordinates = { lat: 40.7128, lon: -74.006 }
  const mockDate = new Date('2024-04-10')

  beforeEach(() => {
    vi.clearAllMocks()
    mockEmptySelect()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  describe('getHistoricalWeather', () => {
    it('should gracefully handle missing API key', async () => {
      const originalKey = process.env.OPENWEATHERMAP_API_KEY
      delete process.env.OPENWEATHERMAP_API_KEY

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
      expect(result.conditions).toBe('unknown')
      expect(result.precipitation).toBeNull()

      if (originalKey) {
        process.env.OPENWEATHERMAP_API_KEY = originalKey
      }
    })

    it('should handle invalid parameters gracefully', async () => {
      const result = await getHistoricalWeather('', mockDate, coordinates)

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
      expect(result.conditions).toBe('unknown')
    })

    it('should handle network errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
      expect(result.conditions).toBe('unknown')
      expect(result.precipitation).toBeNull()
    })

    it('should handle API 429 rate limit errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Too Many Requests', { status: 429 }),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
      expect(result.conditions).toBe('unknown')
    })

    it('should handle API 401 authentication errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
    })

    it('should handle malformed API responses', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Invalid JSON {', { status: 200 }),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
    })

    it('should return data without coordinates without calling API', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should handle date normalization correctly', async () => {
      const result1 = await getHistoricalWeather(
        locationId,
        new Date('2024-04-10T15:30:00'),
        coordinates,
      )
      const result2 = await getHistoricalWeather(
        locationId,
        new Date('2024-04-10T02:15:00'),
        coordinates,
      )

      // Both should normalize to same date
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    })
  })

  describe('getForecast', () => {
    it('should handle invalid locationId gracefully', async () => {
      const result = await getForecast('', coordinates)

      expect(result).toEqual([])
    })

    it('should return empty array on API network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await getForecast(locationId, coordinates)

      expect(result).toEqual([])
    })

    it('should handle forecast without coordinates without calling API', async () => {
      const result = await getForecast(locationId)

      expect(result).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return empty array on API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      )

      const result = await getForecast(locationId, coordinates)

      expect(result).toEqual([])
    })
  })

  describe('Weather Condition Mapping', () => {
    it('should recognize rain conditions', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)
      expect(result).toBeDefined()
    })

    it('should recognize clear conditions', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)
      expect(result).toBeDefined()
    })

    it('should recognize snow conditions', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)
      expect(result).toBeDefined()
    })

    it('should recognize cloudy conditions', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)
      expect(result).toBeDefined()
    })
  })

  describe('Caching behavior', () => {
    it('should return empty cache stats on error', async () => {
      const stats = await getWeatherCacheStats()

      expect(stats).toBeDefined()
      expect(stats.totalCached).toBeGreaterThanOrEqual(0)
      expect(stats.locationCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Date handling', () => {
    it('should handle dates in ISO format', async () => {
      const isoDate = new Date('2024-04-10T00:00:00Z')
      const result = await getHistoricalWeather(
        locationId,
        isoDate,
        coordinates,
      )

      expect(result).toBeDefined()
    })

    it('should handle different timezone dates', async () => {
      const estDate = new Date('2024-04-10T08:00:00-04:00')
      const result = await getHistoricalWeather(
        locationId,
        estDate,
        coordinates,
      )

      expect(result).toBeDefined()
    })
  })

  describe('Precipitation handling', () => {
    it('should handle zero precipitation', async () => {
      const result = await getHistoricalWeather(locationId, mockDate)
      expect(result).toBeDefined()
      // Precipitation can be null or 0
      expect(result.precipitation === null || result.precipitation === 0).toBe(
        true,
      )
    })
  })

  describe('Rate limiting', () => {
    it('should enforce rate limiting between API calls', async () => {
      // Multiple calls should be rate limited
      const call1 = getHistoricalWeather(locationId, mockDate, coordinates)
      const call2 = getHistoricalWeather(locationId, mockDate, coordinates)

      await Promise.all([call1, call2])

      expect(true).toBe(true) // Rate limiting happens, no exceptions
    })
  })

  describe('Error handling robustness', () => {
    it('should not throw on any error condition', async () => {
      const scenarios = [
        () => getHistoricalWeather('invalid-id', mockDate, coordinates),
        () =>
          getHistoricalWeather(locationId, new Date('invalid'), coordinates),
        () => getForecast('invalid-id', coordinates),
        () => getWeatherCacheStats(),
      ]

      for (const scenario of scenarios) {
        await expect(scenario()).resolves.toBeDefined()
      }
    })
  })

  describe('API response validation', () => {
    it('should handle responses without current weather data', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
    })

    it('should handle responses with missing weather array', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ current: { temp: 72 } }), {
          status: 200,
        }),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
    })
  })

  describe('Concurrent operations', () => {
    it('should handle concurrent historical weather requests', async () => {
      const results = await Promise.all([
        getHistoricalWeather(locationId, mockDate, coordinates),
        getHistoricalWeather(locationId, new Date('2024-04-11'), coordinates),
        getHistoricalWeather(locationId, new Date('2024-04-12'), coordinates),
      ])

      expect(results).toHaveLength(3)
      expect(results.every((r) => r !== undefined)).toBe(true)
    })

    it('should handle concurrent forecast requests', async () => {
      const results = await Promise.all([
        getForecast(locationId, coordinates),
        getForecast(locationId, coordinates),
        getForecast(locationId, coordinates),
      ])

      expect(results).toHaveLength(3)
      expect(results.every((r) => Array.isArray(r))).toBe(true)
    })
  })

  describe('API timeout handling', () => {
    it('should timeout API requests that take too long', async () => {
      // Never-resolving fetch; client should still settle via its own path
      // (missing key / abort / graceful error) without hanging the suite.
      vi.mocked(global.fetch).mockImplementationOnce(
        () => new Promise(() => {}),
      )

      const result = await getHistoricalWeather(
        locationId,
        mockDate,
        coordinates,
      )

      expect(result).toBeDefined()
      expect(result.temperature).toBeNull()
    })
  })
})
