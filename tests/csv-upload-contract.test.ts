import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  new URL('../app/api/uploads/route.ts', import.meta.url),
  'utf8',
)
const form = readFileSync(
  new URL('../components/import/csv-upload-form.tsx', import.meta.url),
  'utf8',
)

describe('CSV upload route contract', () => {
  it('streams the raw request body and never parses it as a buffered form', () => {
    expect(route).toContain('request.body')
    expect(route).not.toContain('request.formData')
    expect(route).toContain('x-pantryiq-filename')
    expect(route).toContain('x-pantryiq-import-type')
  })

  it('states the ceiling and honest failure outcome before upload', () => {
    expect(form).toContain('CSV files up to 10 MB')
    expect(form).toContain('Nothing was saved')
    expect(form).toContain('aria-live="polite"')
  })
})
