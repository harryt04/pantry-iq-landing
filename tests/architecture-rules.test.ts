import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Static architecture rules, deliberately checked by reading source.
 *
 * These are the residue of the contract tests the 2026-08-10 audit replaced.
 * Everything that describes *behaviour* moved to a test that runs the code.
 * What is left are rules about what a module may **not** contain, and an
 * absence cannot be observed by calling a function: a test that never triggers
 * the forbidden path passes whether or not the path exists.
 *
 * Keep this file small. A new rule belongs here only if it is a genuine
 * "this module must never reach for that" constraint.
 */

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const WRITE_CALL = /\.insert\(|\.update\(|\.delete\(/

describe('architecture rules', () => {
  it('keeps the narration layer away from the database entirely', () => {
    // Narration receives a precomputed bundle. If it could query, an answer
    // could quietly escape the owner scope the caller already established.
    const narration = source('src/server/chat/narration.ts')

    expect(narration).not.toMatch(/from ['"].*\/db\//)
    expect(narration).not.toMatch(WRITE_CALL)
  })

  it('keeps the chat route read-only', () => {
    // A question must never mutate the account it is asking about.
    expect(source('app/api/chat/route.ts')).not.toMatch(WRITE_CALL)
  })

  it('keeps API routes off the database client', () => {
    // Routes go through owner-scoped services. A direct db import in a route
    // is how an ownership check gets skipped.
    const routes = [
      'app/api/items/route.ts',
      'app/api/items/[itemId]/route.ts',
      'app/api/locations/route.ts',
      'app/api/locations/[locationId]/route.ts',
      'app/api/manual-entry/route.ts',
      'app/api/recipes/route.ts',
      'app/api/reconciliation/route.ts',
      'app/api/uploads/route.ts',
      'app/api/uploads/history/route.ts',
      'app/api/uploads/[uploadId]/commit/route.ts',
      'app/api/uploads/[uploadId]/mapping/route.ts',
      'app/api/uploads/[uploadId]/preview/route.ts',
      'app/api/exports/[exportType]/route.ts',
      'app/api/connectors/status/route.ts',
      'app/api/observability/route.ts',
      'app/api/chat/route.ts',
      'app/api/chat/misses/route.ts',
      'app/api/chat/override/route.ts',
    ]

    for (const route of routes) {
      expect(source(route), route).not.toMatch(/from ['"]@\/src\/server\/db\//)
    }
  })
})
