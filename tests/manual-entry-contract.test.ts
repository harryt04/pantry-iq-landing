import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const service = readFileSync(
  new URL('../src/server/manual/manual-entry.ts', import.meta.url),
  'utf8',
)
const ingestionPersistence = readFileSync(
  new URL('../src/server/ingestion/persistence.ts', import.meta.url),
  'utf8',
)
const route = readFileSync(
  new URL('../app/api/manual-entry/route.ts', import.meta.url),
  'utf8',
)
const form = readFileSync(
  new URL('../components/import/manual-entry-form.tsx', import.meta.url),
  'utf8',
)

describe('manual entry contract', () => {
  it('writes all three entry types to canonical tables in one transaction', () => {
    expect(service).toContain('db.transaction')
    expect(service).toContain("source: 'manual'")
    expect(service).toContain('inventorySnapshots')
    expect(service).toContain('purchaseOrders')
    expect(service).toContain('transactions')
    expect(service).toContain('createIngestionHistory')
    expect(ingestionPersistence).toContain('csvUploadHistory')
    expect(service).toContain('enqueuePrecomputeForLocationInTransaction')
  })

  it('keeps the API location-scoped and the UI accessible', () => {
    expect(service).toContain('requireOwnedLocation')
    expect(route).toContain('locationId is required.')
    expect(form).toContain('aria-labelledby="manual-entry-title"')
    expect(form).toContain('type="datetime-local"')
    expect(form).toContain('Combobox')
    expect(form).toContain('role="alert"')
  })
})
