import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CanonicalField } from '@/src/server/csv/mapping'
import type { CsvDelimiter, CsvEncoding } from '@/src/server/csv/parser'
import type { CsvSecurityErrorCode } from '@/src/server/csv/security'
import type { CsvImportType } from '@/src/server/csv/upload-input'

export type CsvFixtureExpectation = {
  /** Path relative to tests/fixtures/csv. */
  path: string
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
    | { outcome: 'ok'; rowCount?: number; unmatchedItemCount?: number }
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
    plan: { outcome: 'ok', rowCount: 0, unmatchedItemCount: 3 },
    knownIssue:
      'Toast writes item names "Last, first" style (e.g. "Fillet, salmon"). Exact-match item resolution never links these to the catalogue, so every row lands as an unresolved item instead of importing.',
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
    knownIssue:
      'European decimals like "8,50" are read as 850 — decimal() in import-plan.ts strips all commas as thousands separators.',
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
    plan: { outcome: 'error', messageMatch: /item name is required/ },
    knownIssue:
      'Report title and date-range rows above the real header are not skipped. Header detection locks onto the first two lines seen, so the real header and data both get misread and the import fails.',
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
    parse: { hasHeader: false },
    knownIssue:
      'looksLikeHeader() requires every header value to be unique, so a repeated column name (two "Total" columns) makes the whole header row get misread as a data row.',
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
      messageMatch: /not a readable date|is required/,
    },
    knownIssue:
      'Excel serial dates (e.g. 45717) fail Date.parse and raise "is not a readable date" rather than being recognized as a spreadsheet date.',
  },
  {
    path: 'transactions/sales-one-year-daily.csv',
    importType: 'transactions',
    description: 'A full year of daily sales across five items (~1,825 rows).',
    security: 'passes',
    parse: { minReadableRows: 1800 },
    plan: { outcome: 'ok' },
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
      messageMatch: /not a valid number|is required/,
    },
    knownIssue:
      '"1,234.56 USD" and "12.5%" are not recognized by decimal() and raise a row error rather than a clearer currency-format message.',
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
    plan: {
      outcome: 'error',
      messageMatch: /not a valid number/,
    },
    knownIssue:
      'Mixed-number fractions like "3 1/2" are not recognized by decimal() and raise a row error.',
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
