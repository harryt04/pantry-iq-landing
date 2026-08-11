import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildCsvImportPlan } from '@/src/server/csv/import-plan'
import { detectColumnMappings } from '@/src/server/csv/mapping'
import { parseCsvPreview, parseCsvRows } from '@/src/server/csv/parser'
import { assertCsvContent, guardedCsvStream } from '@/src/server/csv/security'
import type { ItemResolutionCandidate } from '@/src/server/ingestion/item-resolution'

import { CSV_FIXTURES_ROOT, csvFixtures, loadFixture } from './manifest'

/**
 * Item catalogue shared by every plan-stage assertion. Names not listed here
 * are intentionally unmatched by fixtures that exercise new-item resolution.
 */
const items: ItemResolutionCandidate[] = [
  {
    id: 'item-1',
    canonicalName: 'salmon fillet',
    displayName: 'Salmon Fillet',
    category: 'seafood',
    unit: 'lb',
  },
  {
    id: 'item-2',
    canonicalName: 'house salad',
    displayName: 'House Salad',
    category: 'salads',
    unit: 'each',
  },
  {
    id: 'item-3',
    canonicalName: 'tomato soup',
    displayName: 'Tomato Soup',
    category: 'soups',
    unit: 'quart',
  },
  {
    id: 'item-4',
    canonicalName: 'romaine lettuce',
    displayName: 'Romaine Lettuce',
    category: 'produce',
    unit: 'each',
  },
  {
    id: 'item-5',
    canonicalName: 'tomato',
    displayName: 'Tomato',
    category: 'produce',
    unit: 'lb',
  },
  {
    id: 'item-6',
    canonicalName: 'chicken breast',
    displayName: 'Chicken Breast',
    category: 'meat',
    unit: 'lb',
  },
  {
    id: 'item-7',
    canonicalName: 'butter',
    displayName: 'Butter',
    category: 'dairy',
    unit: 'lb',
  },
  {
    id: 'item-8',
    canonicalName: 'onion',
    displayName: 'Onion',
    category: 'produce',
    unit: 'lb',
  },
  {
    id: 'item-9',
    canonicalName: 'garlic',
    displayName: 'Garlic',
    category: 'produce',
    unit: 'lb',
  },
]

async function guard(bytes: Uint8Array) {
  const chunks = (async function* () {
    yield bytes
  })()
  const collected: Uint8Array[] = []
  for await (const chunk of guardedCsvStream(chunks)) collected.push(chunk)
  return collected
}

describe('csv fixture corpus', () => {
  it('has a manifest entry for every file on disk', async () => {
    const onDisk = new Set<string>()
    async function walk(dir: string) {
      for (const entry of await readdir(path.join(CSV_FIXTURES_ROOT, dir), {
        withFileTypes: true,
      })) {
        const relative = path.join(dir, entry.name)
        if (entry.isDirectory()) await walk(relative)
        else if (entry.name.endsWith('.csv')) onDisk.add(relative)
      }
    }
    for (const category of [
      'transactions',
      'purchase-orders',
      'inventory',
      'labor',
      'malformed',
      'security',
    ]) {
      await walk(category)
    }

    const inManifest = new Set(csvFixtures.map((fixture) => fixture.path))
    expect([...onDisk].sort()).toEqual([...inManifest].sort())
  })

  for (const fixture of csvFixtures) {
    it(`${fixture.path} — ${fixture.description}`, async () => {
      const bytes = await loadFixture(fixture.path)

      if (fixture.security !== 'passes') {
        await expect(guard(bytes)).rejects.toMatchObject({
          code: fixture.security,
        })
        return
      }
      expect(() => assertCsvContent(bytes)).not.toThrow()

      if (fixture.parse) {
        const preview = await parseCsvPreview(
          (async function* () {
            yield bytes
          })(),
        )
        if (fixture.parse.encoding)
          expect(preview.encoding).toBe(fixture.parse.encoding)
        if (fixture.parse.delimiter)
          expect(preview.delimiter).toBe(fixture.parse.delimiter)
        if (fixture.parse.hasHeader !== undefined)
          expect(preview.hasHeader).toBe(fixture.parse.hasHeader)
        if (fixture.parse.columns)
          expect(preview.columns).toEqual(fixture.parse.columns)
        if (fixture.parse.minReadableRows !== undefined)
          expect(preview.readableRowCount).toBeGreaterThanOrEqual(
            fixture.parse.minReadableRows,
          )
        if (fixture.parse.hasProblems !== undefined)
          expect(preview.problems.length > 0).toBe(fixture.parse.hasProblems)
      }

      if (fixture.mapping || fixture.plan) {
        const preview = await parseCsvPreview(
          (async function* () {
            yield bytes
          })(),
        )
        const detection = detectColumnMappings(preview, fixture.importType)

        if (fixture.mapping) {
          const banded = (band: string) =>
            detection.columns
              .filter((column) => column.band === band)
              .map((column) => column.targetField)
          if (fixture.mapping.auto)
            for (const field of fixture.mapping.auto)
              expect(banded('auto')).toContain(field)
          if (fixture.mapping.review)
            for (const field of fixture.mapping.review)
              expect(banded('review')).toContain(field)
        }

        if (fixture.plan) {
          const rows = await parseCsvRows(
            (async function* () {
              yield bytes
            })(),
          )
          const runPlan = () =>
            buildCsvImportPlan({
              csv: rows,
              importType: fixture.importType,
              mapping: detection.mapping,
              items,
            })

          if (fixture.plan.outcome === 'error') {
            expect(runPlan).toThrow(fixture.plan.messageMatch)
          } else {
            const plan = runPlan()
            if (fixture.plan.rowCount !== undefined)
              expect(plan.rows.length).toBe(fixture.plan.rowCount)
            if (fixture.plan.unmatchedItemCount !== undefined)
              expect(plan.unmatchedItems.length).toBe(
                fixture.plan.unmatchedItemCount,
              )
          }
        }
      }
    })
  }

  it('rejects an upload over the 10 MB cap', async () => {
    const oversizeChunk = new Uint8Array(1024 * 1024).fill(0x61)
    const chunks = (async function* () {
      for (let sent = 0; sent < 11; sent += 1) yield oversizeChunk
    })()
    const collect = async () => {
      for await (const _ of guardedCsvStream(chunks)) {
        // draining the guarded stream
      }
    }
    await expect(collect()).rejects.toMatchObject({
      code: 'UPLOAD_TOO_LARGE',
    })
  })
})
