import { describe, expect, it } from 'vitest'

import { CsvSecurityError, MAX_CSV_UPLOAD_BYTES } from './security'
import {
  CSV_IMPORT_TYPES,
  CsvUploadValidationError,
  validateCsvUploadHeaders,
} from './upload-input'

describe('CSV upload request validation', () => {
  it('accepts each supported import type and preserves the audit filename', () => {
    expect(CSV_IMPORT_TYPES).toEqual([
      'transactions',
      'purchase_orders',
      'inventory',
    ])
    expect(
      validateCsvUploadHeaders({
        filename: '  sales export.csv  ',
        importType: 'transactions',
        contentLength: '42',
      }),
    ).toEqual({ filename: 'sales export.csv', importType: 'transactions' })
  })

  it('rejects unsupported types, unsafe names, and invalid size metadata', () => {
    expect(() =>
      validateCsvUploadHeaders({ filename: 'sales.csv', importType: 'xlsx' }),
    ).toThrowError(CsvUploadValidationError)
    expect(() =>
      validateCsvUploadHeaders({
        filename: 'sales\u0000.csv',
        importType: 'inventory',
      }),
    ).toThrowError(CsvUploadValidationError)
    expect(() =>
      validateCsvUploadHeaders({
        filename: 'sales.csv',
        importType: 'inventory',
        contentLength: 'nope',
      }),
    ).toThrowError(CsvUploadValidationError)
  })

  it('rejects an oversized request from its declared length before reading it', () => {
    expect(() =>
      validateCsvUploadHeaders({
        filename: 'sales.csv',
        importType: 'transactions',
        contentLength: String(MAX_CSV_UPLOAD_BYTES + 1),
      }),
    ).toThrowError(CsvSecurityError)
  })
})
