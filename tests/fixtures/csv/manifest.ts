import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CanonicalField } from '@/src/server/csv/mapping'
import type { CsvDelimiter, CsvEncoding } from '@/src/server/csv/parser'
import type { CsvSecurityErrorCode } from '@/src/server/csv/security'
import type { CsvImportType } from '@/src/server/csv/upload-input'

export type CsvFixtureExpectation = {
  /** Path relative to tests/fixtures/csv. */
  path: string
  /** Exact byte length for fixtures that exercise upload-size boundaries. */
  byteLength?: number
  importType: CsvImportType
  /** What a customer would call this file, for the manual-testing README. */
  description: string
  /** Guard stage (security.ts). */
  security: 'passes' | CsvSecurityErrorCode
  /** Parse stage (parser.ts) — assert only what the file is designed to prove. */
  parse?: {
    encoding?: CsvEncoding
    delimiter?: CsvDelimiter
    hasHeader?: boolean
    columns?: string[]
    minReadableRows?: number
    hasProblems?: boolean
  }
  /** Map stage (mapping.ts) — fields that must land in the given band. */
  mapping?: {
    auto?: CanonicalField[]
    review?: CanonicalField[]
  }
  /** Plan stage (import-plan.ts). */
  plan?:
    | {
        outcome: 'ok'
        rowCount?: number
        unmatchedItemCount?: number
        dateValues?: Array<{ field: CanonicalField; values: string[] }>
      }
    | { outcome: 'error'; messageMatch: RegExp }
  /** Known-wrong current behaviour this file documents, not a bug to fix here. */
  knownIssue?: string
}

export const CSV_FIXTURES_ROOT = path.join(__dirname)

export async function loadFixture(relativePath: string): Promise<Uint8Array> {
  const buffer = await readFile(path.join(CSV_FIXTURES_ROOT, relativePath))
  return new Uint8Array(buffer)
}

export const csvFixtures: CsvFixtureExpectation[] = [
  // --- transactions ---------------------------------------------------
  {
    path: 'transactions/square-item-sales-clean.csv',
    importType: 'transactions',
    description: 'Clean Square item-sales export. Happy path.',
    security: 'passes',
    parse: {
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      minReadableRows: 10,
    },
    mapping: {
      auto: ['transactedAt', 'rawItemName', 'category', 'qty', 'unitPrice'],
    },
    plan: { outcome: 'ok', rowCount: 10, unmatchedItemCount: 0 },
  },
  {
    path: 'transactions/toast-menu-item-sales.csv',
    importType: 'transactions',
    description:
      'Toast menu-item export. CRLF line endings, quoted item names with embedded commas.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 8 },
    plan: { outcome: 'ok', rowCount: 8, unmatchedItemCount: 0 },
  },
  {
    path: 'transactions/item-resolution-near-misses.csv',
    importType: 'transactions',
    description:
      'Transaction export mixing whitespace and case normalization with plural and ampersand near-misses that must remain unresolved.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 5 },
    plan: { outcome: 'ok', rowCount: 3, unmatchedItemCount: 2 },
  },
  {
    path: 'transactions/clover-payments-export.csv',
    importType: 'transactions',
    description:
      'Clover payments export. Dollar signs and thousands separators in amounts.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 6 },
    plan: { outcome: 'ok', rowCount: 6 },
  },
  {
    path: 'transactions/lightspeed-sales-semicolon.csv',
    importType: 'transactions',
    description:
      'Lightspeed export using a semicolon delimiter and European comma decimals.',
    security: 'passes',
    parse: { delimiter: ';', hasHeader: true, minReadableRows: 5 },
    plan: { outcome: 'ok', rowCount: 5 },
  },
  {
    path: 'transactions/revel-sales-tab-delimited.csv',
    importType: 'transactions',
    description: 'Revel export using a tab delimiter.',
    security: 'passes',
    parse: { delimiter: '\t', hasHeader: true, minReadableRows: 5 },
    plan: { outcome: 'ok', rowCount: 5 },
  },
  {
    path: 'transactions/square-latin1-accents.csv',
    importType: 'transactions',
    description: 'Square export saved as Latin-1 with accented item names.',
    security: 'passes',
    parse: { encoding: 'latin-1', hasHeader: true, minReadableRows: 4 },
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 2 },
  },
  {
    path: 'transactions/square-utf8-bom.csv',
    importType: 'transactions',
    description:
      'Square export with a UTF-8 byte-order mark and emoji item names.',
    security: 'passes',
    parse: { encoding: 'utf-8', hasHeader: true, minReadableRows: 3 },
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 2 },
  },
  {
    path: 'transactions/toast-with-preamble-rows.csv',
    importType: 'transactions',
    description:
      'Toast export with report title and date-range rows above the real header.',
    security: 'passes',
    parse: {
      hasHeader: true,
      columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
      minReadableRows: 5,
    },
    plan: { outcome: 'ok', rowCount: 5, unmatchedItemCount: 0 },
  },
  {
    path: 'transactions/pos-headerless-sales.csv',
    importType: 'transactions',
    description: 'A generic POS export with no header row at all.',
    security: 'passes',
    parse: { hasHeader: false, minReadableRows: 5 },
  },
  {
    path: 'transactions/sales-duplicate-headers.csv',
    importType: 'transactions',
    description: 'Export with two columns both named "Total".',
    security: 'passes',
    parse: {
      hasHeader: true,
      columns: ['Date', 'Item', 'Qty', 'Total', 'Total (2)'],
      minReadableRows: 4,
    },
  },
  {
    path: 'transactions/sales-ambiguous-headers.csv',
    importType: 'transactions',
    description:
      'Generic headers (Date, Type, Description, Amount) with no strong field signal.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 5 },
  },
  {
    path: 'transactions/sales-modifiers-and-customizations.csv',
    importType: 'transactions',
    description:
      'Item names with modifier clauses ("no whip", "add bacon", "on the side").',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3, unmatchedItemCount: 2 },
  },
  {
    path: 'transactions/sales-with-refunds-negative.csv',
    importType: 'transactions',
    description:
      'Refund rows using both parenthesized and minus-sign negative amounts.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 5 },
  },
  {
    path: 'transactions/sales-messy-dates-mixed.csv',
    importType: 'transactions',
    description:
      'Five date formats in one column: slash, abbreviated month, ISO timestamp, Excel serial, and blank.',
    security: 'passes',
    plan: {
      outcome: 'error',
      messageMatch: /is required/,
    },
  },
  {
    path: 'transactions/sales-one-year-daily.csv',
    importType: 'transactions',
    description: 'A full year of daily sales across five items (~1,825 rows).',
    security: 'passes',
    parse: { minReadableRows: 1800 },
    plan: { outcome: 'ok' },
  },
  {
    path: 'transactions/sales-business-day-boundary.csv',
    importType: 'transactions',
    description:
      'Two sales on the same calendar date, including a 01:30 sale that belongs to the prior business day.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 2, unmatchedItemCount: 0 },
  },
  {
    path: 'transactions/sales-money-precision.csv',
    importType: 'transactions',
    description:
      'Two decimal money rows whose exact sum must survive import, metrics, and dashboard rendering.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 2, unmatchedItemCount: 0 },
  },
  {
    path: 'transactions/sales-dst-boundary.csv',
    importType: 'transactions',
    description:
      'Timezone-suffixed sales across spring-forward and fall-back DST boundaries, including the repeated local hour.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 4 },
    plan: {
      outcome: 'ok',
      rowCount: 4,
      unmatchedItemCount: 0,
      dateValues: [
        {
          field: 'transactedAt',
          values: [
            '2026-03-08T09:59:59.000Z',
            '2026-03-08T10:00:00.000Z',
            '2026-11-01T07:30:00.000Z',
            '2026-11-01T08:30:00.000Z',
          ],
        },
      ],
    },
  },
  {
    path: 'transactions/sales-timezone-suffixed.csv',
    importType: 'transactions',
    description:
      'The same wall-clock timestamp expressed with UTC, Mountain, and India offsets.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 3 },
    plan: {
      outcome: 'ok',
      rowCount: 3,
      unmatchedItemCount: 0,
      dateValues: [
        {
          field: 'transactedAt',
          values: [
            '2026-08-08T12:00:00.000Z',
            '2026-08-08T18:00:00.000Z',
            '2026-08-08T06:30:00.000Z',
          ],
        },
      ],
    },
  },
  {
    path: 'transactions/sales-ambiguous-date-formats.csv',
    importType: 'transactions',
    description:
      'Slash-separated dates where DD/MM and MM/DD interpretations are both plausible.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 2, unmatchedItemCount: 0 },
  },

  // --- scale -----------------------------------------------------------
  {
    path: 'scale/transactions-100k-rows.csv',
    importType: 'transactions',
    description:
      'A 100,000-row transaction export that remains below the 10 MiB upload cap.',
    security: 'passes',
    byteLength: 3_300_025,
    parse: { hasHeader: true, minReadableRows: 100_000 },
  },
  {
    path: 'scale/transactions-9-9-mb.csv',
    importType: 'transactions',
    description:
      'A valid CSV whose 9,900,000 bytes exercise a large upload below the cap.',
    security: 'passes',
    byteLength: 9_900_000,
  },
  {
    path: 'scale/transactions-exactly-10-mib.csv',
    importType: 'transactions',
    description:
      'A valid CSV exactly at the 10 MiB upload boundary; the guard must accept it.',
    security: 'passes',
    byteLength: 10 * 1024 * 1024,
  },

  // --- encoding ---------------------------------------------------------
  {
    path: 'encoding/transactions-utf16le-bom.csv',
    importType: 'transactions',
    description:
      'UTF-16LE transaction export with a byte-order mark and accented item names.',
    security: 'passes',
    parse: {
      encoding: 'utf-16le',
      hasHeader: true,
      columns: ['Date', 'Item Name', 'Qty', 'Total Revenue'],
      minReadableRows: 2,
    },
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 1 },
  },
  {
    path: 'encoding/transactions-cp1252-smart-quotes.csv',
    importType: 'transactions',
    description:
      'CP1252 transaction export with curly quote bytes around an item name.',
    security: 'passes',
    parse: {
      encoding: 'windows-1252',
      hasHeader: true,
      minReadableRows: 1,
    },
  },
  {
    path: 'encoding/transactions-mixed-encodings.csv',
    importType: 'transactions',
    description:
      'Transaction export containing both UTF-8 and CP1252 byte sequences; reject ambiguous decoding.',
    security: 'NOT_CSV_CONTENT',
  },

  // --- purchase orders --------------------------------------------------
  {
    path: 'purchase-orders/sysco-invoice-export.csv',
    importType: 'purchase_orders',
    description: 'Sysco invoice export with PO numbers grouping line items.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 4 },
  },
  {
    path: 'purchase-orders/usfoods-order-guide.csv',
    importType: 'purchase_orders',
    description:
      'US Foods order guide export with vendor-specific header names.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'purchase-orders/marketman-purchases.csv',
    importType: 'purchase_orders',
    description: 'MarketMan purchasing export with order and received dates.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'purchase-orders/po-multiline-single-order.csv',
    importType: 'purchase_orders',
    description:
      'One purchase order with twelve line items sharing a PO number.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 7, unmatchedItemCount: 5 },
  },
  {
    path: 'purchase-orders/po-missing-external-id.csv',
    importType: 'purchase_orders',
    description: 'Purchase order rows with no PO number column at all.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'purchase-orders/po-received-before-ordered.csv',
    importType: 'purchase_orders',
    description:
      'A received date earlier than the order date (data entry error).',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 2 },
  },
  {
    path: 'purchase-orders/po-unit-cost-times-qty-mismatch.csv',
    importType: 'purchase_orders',
    description:
      'Unit cost times quantity does not equal the stated total cost.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 2 },
  },
  {
    path: 'purchase-orders/po-currency-symbols-mixed.csv',
    importType: 'purchase_orders',
    description:
      'Mixed currency symbols ($, £, €) plus a currency-coded amount and a percentage.',
    security: 'passes',
    plan: {
      outcome: 'error',
      messageMatch: /currency code|percentage/,
    },
  },
  {
    path: 'purchase-orders/po-blank-received-dates.csv',
    importType: 'purchase_orders',
    description: 'Received date left blank for orders still in transit.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },

  // --- inventory ----------------------------------------------------------
  {
    path: 'inventory/manual-count-sheet.csv',
    importType: 'inventory',
    description:
      'A manual weekly count sheet, typed up from a clipboard tally.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 4 },
  },
  {
    path: 'inventory/inventory-with-units-and-shelf-life.csv',
    importType: 'inventory',
    description: 'Inventory count including unit of measure and shelf life.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3, unmatchedItemCount: 1 },
  },
  {
    path: 'inventory/inventory-fractional-quantities.csv',
    importType: 'inventory',
    description:
      'Fractional quantities: decimals, a leading-dot decimal, and a mixed-number fraction.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 4, unmatchedItemCount: 0 },
  },
  {
    path: 'inventory/inventory-zero-and-blank-qty.csv',
    importType: 'inventory',
    description: 'A zero-quantity row and a blank-quantity row.',
    security: 'passes',
    plan: {
      outcome: 'error',
      messageMatch: /is required/,
    },
  },
  {
    path: 'inventory/inventory-new-items-only.csv',
    importType: 'inventory',
    description:
      'Every item name is new to the catalogue and needs manual resolution.',
    security: 'passes',
    plan: { outcome: 'ok', unmatchedItemCount: 3 },
  },
  {
    path: 'inventory/inventory-mixed-case-whitespace-names.csv',
    importType: 'inventory',
    description:
      'The same item spelled with different case and stray whitespace across rows.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'inventory/inventory-two-counts-same-day.csv',
    importType: 'inventory',
    description:
      'The same item counted twice on the same day with different totals.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },

  // --- labor ----------------------------------------------------------
  {
    path: 'labor/7shifts-timesheet.csv',
    importType: 'labor',
    description: '7shifts timesheet export with scheduled and actual hours.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'labor/homebase-timesheet.csv',
    importType: 'labor',
    description: 'Homebase timesheet export using clock in/out column names.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'labor/labor-scheduled-only.csv',
    importType: 'labor',
    description: 'Only scheduled hours are present, no actual hours column.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 3 },
  },
  {
    path: 'labor/labor-actual-only.csv',
    importType: 'labor',
    description:
      'Only actual (clocked) hours are present, no scheduled hours column.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 2 },
  },
  {
    path: 'labor/labor-missing-both-hours.csv',
    importType: 'labor',
    description: 'Neither scheduled nor actual hours are present anywhere.',
    security: 'passes',
    plan: {
      outcome: 'error',
      messageMatch: /map scheduled hours or actual hours/,
    },
  },
  {
    path: 'labor/labor-open-shift-no-end.csv',
    importType: 'labor',
    description:
      'An overnight shift with a blank shift-end time (still clocked in).',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 2 },
  },

  // --- malformed --------------------------------------------------------
  {
    path: 'malformed/ragged-column-counts.csv',
    importType: 'transactions',
    description: 'Rows with more or fewer columns than the header.',
    security: 'passes',
    parse: { hasHeader: true, hasProblems: true },
  },
  {
    path: 'malformed/quotes-unterminated.csv',
    importType: 'transactions',
    description: 'A quoted field that is never closed.',
    security: 'passes',
  },
  {
    path: 'malformed/quotes-embedded-newlines.csv',
    importType: 'transactions',
    description: 'A quoted item name that spans multiple lines.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 1 },
  },
  {
    path: 'malformed/quotes-escaped-doubled.csv',
    importType: 'transactions',
    description: 'An item name containing doubled-quote escaping.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 1 },
  },
  {
    path: 'malformed/blank-lines-and-trailing-whitespace.csv',
    importType: 'transactions',
    description:
      'Leading/trailing whitespace around headers and values, blank lines.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 2 },
    plan: { outcome: 'ok', rowCount: 2 },
  },
  {
    path: 'malformed/header-only-no-rows.csv',
    importType: 'transactions',
    description: 'A header row with no data rows beneath it.',
    security: 'passes',
    parse: { minReadableRows: 0 },
  },
  {
    path: 'malformed/single-column-no-delimiter.csv',
    importType: 'transactions',
    description:
      'Free text with no comma, semicolon, tab, or line break anywhere — not a CSV.',
    security: 'NOT_CSV_CONTENT',
  },
  {
    path: 'malformed/trailing-totals-row.csv',
    importType: 'transactions',
    description:
      'A spreadsheet-style TOTAL row appended after the real data rows.',
    security: 'passes',
    parse: { hasHeader: true, minReadableRows: 4 },
  },

  // --- security ---------------------------------------------------------
  {
    path: 'security/renamed-xlsx.csv',
    importType: 'transactions',
    description: 'An Excel .xlsx file renamed with a .csv extension.',
    security: 'NOT_CSV_CONTENT',
  },
  {
    path: 'security/renamed-pdf.csv',
    importType: 'transactions',
    description: 'A PDF file renamed with a .csv extension.',
    security: 'NOT_CSV_CONTENT',
  },
  {
    path: 'security/contains-null-bytes.csv',
    importType: 'transactions',
    description: 'A CSV containing an embedded null byte.',
    security: 'NOT_CSV_CONTENT',
  },
  {
    path: 'security/formula-injection.csv',
    importType: 'transactions',
    description:
      'Item names starting with =, +, @, and - that resemble spreadsheet formulas, plus a legitimate negative amount.',
    security: 'passes',
    plan: { outcome: 'ok', rowCount: 1, unmatchedItemCount: 4 },
  },
  {
    path: 'security/empty-file.csv',
    importType: 'transactions',
    description: 'A zero-byte file.',
    security: 'EMPTY_FILE',
  },
]
