import type { CsvImportType } from './upload-input'
import type { CsvPreview } from './parser'

export type MappingConfidenceBand = 'auto' | 'review' | 'unmapped'

export type CanonicalField =
  | 'transactedAt'
  | 'externalId'
  | 'rawItemName'
  | 'category'
  | 'qty'
  | 'unitPrice'
  | 'totalRevenue'
  | 'totalCost'
  | 'grossMargin'
  | 'orderedAt'
  | 'receivedAt'
  | 'supplierName'
  | 'unitCost'
  | 'countedAt'
  | 'unit'
  | 'shelfLifeDays'

type ValueShape = 'date' | 'number' | 'text' | 'identifier'

type FieldDefinition = {
  field: CanonicalField
  aliases: string[]
  shape: ValueShape
}

type ScoredCandidate = {
  field: CanonicalField
  confidence: number
  evidence: string[]
  prior: boolean
}

export type CsvColumnDetection = {
  sourceColumn: string
  sourceIndex: number
  targetField: CanonicalField | null
  confidence: number
  band: MappingConfidenceBand
  evidence: string[]
  candidates: ScoredCandidate[]
}

export type CsvMappingDetection = {
  importType: CsvImportType
  columns: CsvColumnDetection[]
  mapping: Record<string, CanonicalField | null>
  reused: boolean
}

export type StoredCsvMapping = Record<string, CanonicalField | null>

export const canonicalFieldLabels: Record<CanonicalField, string> = {
  transactedAt: 'Transaction date and time',
  externalId: 'External ID',
  rawItemName: 'Item name',
  category: 'Category',
  qty: 'Quantity',
  unitPrice: 'Unit price',
  totalRevenue: 'Total revenue',
  totalCost: 'Total cost',
  grossMargin: 'Gross margin',
  orderedAt: 'Order date',
  receivedAt: 'Received date',
  supplierName: 'Supplier name',
  unitCost: 'Unit cost',
  countedAt: 'Count date',
  unit: 'Unit of measure',
  shelfLifeDays: 'Shelf life in days',
}

const definitions: Record<CsvImportType, FieldDefinition[]> = {
  transactions: [
    {
      field: 'transactedAt',
      aliases: [
        'date',
        'time',
        'timestamp',
        'datetime',
        'transaction date',
        'transaction time',
        'transacted at',
        'sale date',
        'sales date',
      ],
      shape: 'date',
    },
    {
      field: 'externalId',
      aliases: [
        'id',
        'transaction id',
        'transaction number',
        'receipt id',
        'order id',
        'external id',
      ],
      shape: 'identifier',
    },
    {
      field: 'rawItemName',
      aliases: [
        'item',
        'item name',
        'item description',
        'product',
        'product name',
        'menu item',
        'description',
      ],
      shape: 'text',
    },
    {
      field: 'category',
      aliases: ['category', 'item category', 'product category', 'type'],
      shape: 'text',
    },
    {
      field: 'qty',
      aliases: ['qty', 'quantity', 'units', 'units sold', 'quantity sold'],
      shape: 'number',
    },
    {
      field: 'unitPrice',
      aliases: ['unit price', 'price per unit', 'selling price', 'sale price'],
      shape: 'number',
    },
    {
      field: 'totalRevenue',
      aliases: [
        'total',
        'total revenue',
        'revenue',
        'sales',
        'sales amount',
        'gross sales',
        'net sales',
        'amount',
      ],
      shape: 'number',
    },
    {
      field: 'totalCost',
      aliases: ['total cost', 'cost', 'cogs', 'cost of goods', 'food cost'],
      shape: 'number',
    },
    {
      field: 'grossMargin',
      aliases: ['gross margin', 'gross profit', 'profit', 'margin'],
      shape: 'number',
    },
  ],
  purchase_orders: [
    {
      field: 'orderedAt',
      aliases: ['date', 'order date', 'ordered at', 'po date', 'purchase date'],
      shape: 'date',
    },
    {
      field: 'receivedAt',
      aliases: [
        'received date',
        'received at',
        'delivery date',
        'arrival date',
      ],
      shape: 'date',
    },
    {
      field: 'externalId',
      aliases: [
        'id',
        'po id',
        'po number',
        'purchase order',
        'purchase order number',
        'order id',
        'external id',
      ],
      shape: 'identifier',
    },
    {
      field: 'supplierName',
      aliases: ['supplier', 'supplier name', 'vendor', 'vendor name'],
      shape: 'text',
    },
    {
      field: 'rawItemName',
      aliases: [
        'item',
        'item name',
        'item description',
        'product',
        'description',
      ],
      shape: 'text',
    },
    {
      field: 'qty',
      aliases: [
        'qty',
        'quantity',
        'quantity ordered',
        'units',
        'units ordered',
      ],
      shape: 'number',
    },
    {
      field: 'unitCost',
      aliases: ['unit cost', 'cost per unit', 'price per unit', 'unit price'],
      shape: 'number',
    },
    {
      field: 'totalCost',
      aliases: ['total cost', 'extended cost', 'cost', 'amount'],
      shape: 'number',
    },
  ],
  inventory: [
    {
      field: 'countedAt',
      aliases: [
        'date',
        'count date',
        'counted at',
        'inventory date',
        'snapshot date',
      ],
      shape: 'date',
    },
    {
      field: 'externalId',
      aliases: ['id', 'item id', 'sku', 'snapshot id', 'external id'],
      shape: 'identifier',
    },
    {
      field: 'rawItemName',
      aliases: [
        'item',
        'item name',
        'item description',
        'product',
        'description',
      ],
      shape: 'text',
    },
    {
      field: 'qty',
      aliases: [
        'qty',
        'quantity',
        'on hand',
        'on hand quantity',
        'stock',
        'inventory quantity',
        'count',
      ],
      shape: 'number',
    },
    {
      field: 'category',
      aliases: ['category', 'item category', 'product category', 'type'],
      shape: 'text',
    },
    {
      field: 'unit',
      aliases: ['unit', 'uom', 'unit of measure'],
      shape: 'text',
    },
    {
      field: 'shelfLifeDays',
      aliases: [
        'shelf life',
        'shelf life days',
        'days to spoil',
        'expiry days',
      ],
      shape: 'number',
    },
  ],
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
    .replaceAll(/\s+/g, ' ')
}

function headerMatch(
  header: string,
  aliases: string[],
): {
  score: number
  alias: string | undefined
} {
  const normalizedHeader = normalize(header)
  let best = { score: 0, alias: undefined as string | undefined }
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias)
    if (normalizedHeader === normalizedAlias && best.score < 1) {
      best = { score: 1, alias }
      continue
    }
    if (
      normalizedHeader.includes(normalizedAlias) &&
      normalizedAlias.length > 2 &&
      best.score < 0.84
    ) {
      best = { score: 0.84, alias }
      continue
    }
    const headerTokens = new Set(normalizedHeader.split(' '))
    const aliasTokens = normalizedAlias.split(' ')
    const overlap = aliasTokens.filter((token) =>
      headerTokens.has(token),
    ).length
    const score = aliasTokens.length ? 0.48 * (overlap / aliasTokens.length) : 0
    if (score > best.score) best = { score, alias }
  }
  return best
}

function isNumeric(value: string): boolean {
  const normalized = value
    .trim()
    .replaceAll(',', '')
    .replace(/^\((.*)\)$/, '-$1')
    .replace(/^[$£€]/, '')
    .replace(/%$/, '')
  return /^[-+]?\d+(\.\d+)?$/.test(normalized)
}

function isDate(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || isNumeric(trimmed)) return false
  if (!/[\d/-]/.test(trimmed)) return false
  return !Number.isNaN(Date.parse(trimmed))
}

function isIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9._/-]*$/i.test(value.trim())
}

function shapeScore(
  shape: ValueShape,
  values: string[],
): {
  score: number
  evidence: string
} {
  const samples = values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5)
  if (samples.length === 0)
    return { score: 0.5, evidence: 'No sample values were available.' }

  const matches =
    shape === 'date'
      ? samples.filter(isDate).length
      : shape === 'number'
        ? samples.filter(isNumeric).length
        : shape === 'identifier'
          ? samples.filter(isIdentifier).length
          : samples.filter((value) => !isNumeric(value) && !isDate(value))
              .length
  const score = matches / samples.length
  const label =
    shape === 'date'
      ? 'date'
      : shape === 'number'
        ? 'numeric'
        : shape === 'identifier'
          ? 'identifier'
          : 'text'
  return {
    score,
    evidence: `${Math.round(score * 100)}% of sampled values look ${label}.`,
  }
}

function confidenceFor(
  headerScore: number,
  valueScore: number,
  shape: ValueShape,
): number {
  if (headerScore >= 0.99) return Math.round(85 + valueScore * 15)
  if (headerScore > 0) return Math.round(headerScore * 65 + valueScore * 25)
  return Math.round(valueScore * (shape === 'text' ? 35 : 60))
}

function bandFor(confidence: number): MappingConfidenceBand {
  if (confidence >= 85) return 'auto'
  if (confidence >= 50) return 'review'
  return 'unmapped'
}

function isCanonicalField(value: string): value is CanonicalField {
  return Object.values(definitions).some((fields) =>
    fields.some((definition) => definition.field === value),
  )
}

function fieldsFor(importType: CsvImportType): Set<CanonicalField> {
  return new Set(definitions[importType].map((definition) => definition.field))
}

export function parseStoredCsvMapping(
  value: unknown,
  importType: CsvImportType,
): StoredCsvMapping | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const allowedFields = fieldsFor(importType)
  const mapping = Object.create(null) as StoredCsvMapping
  for (const [sourceColumn, targetField] of Object.entries(value)) {
    if (
      sourceColumn.trim().length === 0 ||
      (targetField !== null &&
        (typeof targetField !== 'string' ||
          !allowedFields.has(targetField as CanonicalField)))
    ) {
      return null
    }
    mapping[sourceColumn] = targetField
  }
  return Object.keys(mapping).length > 0 ? mapping : null
}

function sameColumnShape(
  columns: string[],
  mapping: StoredCsvMapping,
): boolean {
  const normalizedColumns = columns.map(normalize)
  const normalizedMapping = Object.keys(mapping).map(normalize)
  return (
    normalizedColumns.length === normalizedMapping.length &&
    new Set(normalizedColumns).size === normalizedColumns.length &&
    normalizedColumns.every((column) => normalizedMapping.includes(column))
  )
}

export function findReusableCsvMapping(
  columns: string[],
  importType: CsvImportType,
  priorMappings: unknown[],
): StoredCsvMapping | null {
  for (const candidate of priorMappings) {
    const mapping = parseStoredCsvMapping(candidate, importType)
    if (mapping && sameColumnShape(columns, mapping)) return mapping
  }
  return null
}

export function detectionFromStoredCsvMapping(
  preview: Pick<CsvPreview, 'columns' | 'previewRows'>,
  importType: CsvImportType,
  storedMapping: StoredCsvMapping,
): CsvMappingDetection {
  const detected = detectColumnMappings(preview, importType)
  const byNormalizedColumn = new Map(
    Object.entries(storedMapping).map(([column, field]) => [
      normalize(column),
      field,
    ]),
  )
  const columns = detected.columns.map((column) => ({
    ...column,
    targetField: byNormalizedColumn.get(normalize(column.sourceColumn)) ?? null,
    confidence: 100,
    band: 'auto' as const,
    evidence: ['This mapping was reused from an earlier import.'],
  }))
  return {
    importType,
    columns,
    mapping: Object.fromEntries(
      columns.map((column) => [column.sourceColumn, column.targetField]),
    ) as StoredCsvMapping,
    reused: true,
  }
}

export function detectColumnMappings(
  preview: Pick<CsvPreview, 'columns' | 'previewRows'>,
  importType: CsvImportType,
  priorMappings: Record<string, string | null> = {},
): CsvMappingDetection {
  const fields = definitions[importType]
  const normalizedPriorMappings = new Map(
    Object.entries(priorMappings).map(([column, field]) => [
      normalize(column),
      field,
    ]),
  )

  const scored = preview.columns.map((sourceColumn, sourceIndex) => {
    const values = preview.previewRows.map(
      (row) => row.values[sourceIndex] ?? '',
    )
    const priorField = normalizedPriorMappings.get(normalize(sourceColumn))
    const candidates = fields
      .map((definition) => {
        const header = headerMatch(sourceColumn, definition.aliases)
        const shape = shapeScore(definition.shape, values)
        const prior = priorField === definition.field
        let confidence = confidenceFor(
          header.score,
          shape.score,
          definition.shape,
        )
        const evidence = []
        if (header.alias) evidence.push(`Header matches “${header.alias}”.`)
        evidence.push(shape.evidence)
        if (prior) {
          confidence = Math.min(100, Math.max(confidence + 20, 92))
          evidence.push('A prior mapping for this column supports this field.')
        }
        return {
          field: definition.field,
          confidence,
          evidence,
          prior,
        }
      })
      .sort((left, right) => right.confidence - left.confidence)
      .sort(
        (left, right) =>
          Number(right.prior) - Number(left.prior) ||
          right.confidence - left.confidence,
      )
      .slice(0, 3)
    return { sourceColumn, sourceIndex, candidates }
  })

  const usedFields = new Set<CanonicalField>()
  const ordered = [...scored].sort((left, right) => {
    const scoreDifference =
      (right.candidates[0]?.confidence ?? 0) -
      (left.candidates[0]?.confidence ?? 0)
    return scoreDifference || left.sourceIndex - right.sourceIndex
  })
  const detections = new Map<number, CsvColumnDetection>()

  for (const column of ordered) {
    const candidate = column.candidates.find(
      (entry) => !usedFields.has(entry.field),
    )
    const confidence = candidate?.confidence ?? 0
    const band = bandFor(confidence)
    const targetField = band === 'unmapped' ? null : (candidate?.field ?? null)
    if (targetField) usedFields.add(targetField)
    detections.set(column.sourceIndex, {
      sourceColumn: column.sourceColumn,
      sourceIndex: column.sourceIndex,
      targetField,
      confidence,
      band,
      evidence: candidate?.evidence ?? [
        'No canonical field matched this column.',
      ],
      candidates: column.candidates,
    })
  }

  const columns = preview.columns.map(
    (_, index) => detections.get(index) as CsvColumnDetection,
  )
  return {
    importType,
    columns,
    mapping: Object.fromEntries(
      columns.map((column) => [column.sourceColumn, column.targetField]),
    ) as Record<string, CanonicalField | null>,
    reused: false,
  }
}

export function isKnownCanonicalField(value: string): value is CanonicalField {
  return isCanonicalField(value)
}
