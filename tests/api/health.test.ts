import { describe, expect, it } from 'vitest'

import { GET } from '@/app/api/health/route'
import { buildRequest, callRoute } from '../helpers/api-request'

/**
 * Small, but playwright.config.ts polls this route to decide the dev server is
 * up. If its shape changes, every browser suite hangs for two minutes and then
 * fails with a timeout that points nowhere near the cause.
 */
describe('GET /api/health', () => {
  it('reports ok without requiring a session', async () => {
    const { status, body } = await callRoute(GET, buildRequest('/api/health'))

    expect(status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })
})
