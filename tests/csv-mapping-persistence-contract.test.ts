import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  new URL('../app/api/uploads/[uploadId]/mapping/route.ts', import.meta.url),
  'utf8',
)
const preview = readFileSync(
  new URL('../src/server/csv/previews.ts', import.meta.url),
  'utf8',
)

describe('CSV mapping persistence contract', () => {
  it('saves accepted mappings through an authenticated patch route', () => {
    expect(route).toContain('export async function PATCH')
    expect(route).toContain('saveCsvMapping')
    expect(route).toContain('request.json()')
  })

  it('looks up reusable mappings only within the same location and import type', () => {
    expect(preview).toContain(
      'eq(csvUploadHistory.locationId, upload.locationId)',
    )
    expect(preview).toContain('eq(csvUploadHistory.source, importType)')
    expect(preview).toContain('findReusableCsvMapping')
  })
})
