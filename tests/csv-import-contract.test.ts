import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  new URL('../app/api/uploads/[uploadId]/commit/route.ts', import.meta.url),
  'utf8',
)
const service = readFileSync(
  new URL('../src/server/csv/imports.ts', import.meta.url),
  'utf8',
)
const ingestionPersistence = readFileSync(
  new URL('../src/server/ingestion/persistence.ts', import.meta.url),
  'utf8',
)
const form = readFileSync(
  new URL('../components/import/csv-upload-form.tsx', import.meta.url),
  'utf8',
)

describe('CSV import commit contract', () => {
  it('exposes a dry-run and commit endpoint with an atomic service boundary', () => {
    expect(route).toContain('dryRun')
    expect(route).toContain('commitCsvImport')
    expect(service).toContain('db.transaction')
    expect(service).toContain('persistNormalizedRecords')
    expect(ingestionPersistence).toContain('onConflictDoNothing')
    expect(ingestionPersistence).toContain("status: 'imported'")
    expect(service).toContain('enqueuePrecomputeForLocationInTransaction')
  })

  it('keeps history location-scoped and presents real confirmation counts', () => {
    expect(service).toContain('requireOwnedLocation')
    expect(service).toContain(
      'eq(csvUploadHistory.locationId, owned.locationId)',
    )
    expect(form).toContain('rowsToImport.toLocaleString()')
    expect(form).toContain('rowsImported.toLocaleString()')
    expect(form).toContain('newItems.toLocaleString()')
  })
})
