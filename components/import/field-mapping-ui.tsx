'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { ImportType } from '@/components/import/csv-upload'

interface FieldMappingUIProps {
  uploadId: string
  headers: string[]
  preview: Record<string, string>[]
  importType?: ImportType
  onMappingConfirmed?: (mapping: Record<string, string | null>) => void
  onCancel?: () => void
}

interface FieldMapping {
  [sourceColumn: string]: string | null
}

const COMMON_FIELD_OPTIONS = [
  { value: null, label: 'Skip this column' },
  { value: 'date', label: 'Date' },
  { value: 'item', label: 'Item/Product' },
  { value: 'location', label: 'Location' },
  { value: 'source', label: 'Source' },
]

const FIELD_OPTIONS_BY_IMPORT_TYPE = {
  transactions: [
    ...COMMON_FIELD_OPTIONS,
    { value: 'qty', label: 'Quantity Sold' },
    { value: 'revenue', label: 'Revenue/Sales' },
    { value: 'cost', label: 'Cost' },
  ],
  purchase_orders: [
    ...COMMON_FIELD_OPTIONS,
    { value: 'qty', label: 'Quantity Ordered' },
    { value: 'unitCost', label: 'Unit Cost' },
    { value: 'cost', label: 'Unit Cost (legacy)' },
    { value: 'supplier', label: 'Supplier/Vendor' },
    { value: 'deliveryDate', label: 'Delivery Date' },
  ],
  inventory_snapshots: [
    ...COMMON_FIELD_OPTIONS,
    { value: 'qtyOnHand', label: 'Quantity On Hand' },
    { value: 'snapshotType', label: 'Snapshot Type' },
  ],
} as const

export function FieldMappingUI({
  uploadId,
  headers,
  preview,
  importType = 'transactions',
  onMappingConfirmed,
  onCancel,
}: FieldMappingUIProps) {
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    rowsImported?: number
    errors?: Array<{ row: number; message: string }>
  } | null>(null)

  // Load suggestions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/csv/field-mapping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.message || 'Failed to load field suggestions')
          return
        }

        if (data.suggestedMapping) {
          setMapping(data.suggestedMapping)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(`Failed to load suggestions: ${message}`)
        // Initialize with empty mapping
        const emptyMapping: FieldMapping = {}
        headers.forEach((h) => {
          emptyMapping[h] = null
        })
        setMapping(emptyMapping)
      } finally {
        setIsLoading(false)
      }
    }

    loadSuggestions()
  }, [uploadId, headers])

  const handleMappingChange = (column: string, field: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [column]: field,
    }))
  }

  const handleConfirm = async () => {
    // Validate that required fields are mapped
    const mappedFields = new Set(
      Object.values(mapping).filter((v) => v !== null),
    )
    if (!mappedFields.has('item')) {
      setError('Required field "Item" must be mapped')
      return
    }

    setIsConfirming(true)
    setError(null)

    try {
      const response = await fetch(`/api/csv/field-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          confirmedMapping: mapping,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to import data')
        return
      }

      setImportResult({
        success: data.success,
        rowsImported: data.rowsImported,
        errors: data.errors,
      })

      // Call callback
      onMappingConfirmed?.(mapping)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to confirm mapping: ${message}`)
    } finally {
      setIsConfirming(false)
    }
  }

  // Show import result
  if (importResult) {
    return (
      <Card
        className={
          importResult.success
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
            : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
        }
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={
                importResult.success
                  ? 'h-5 w-5 text-green-600 dark:text-green-400'
                  : 'h-5 w-5 text-yellow-600 dark:text-yellow-400'
              }
            />
            <div>
              <CardTitle
                className={
                  importResult.success
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-yellow-900 dark:text-yellow-100'
                }
              >
                Import Complete
              </CardTitle>
              <CardDescription
                className={
                  importResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-yellow-800 dark:text-yellow-200'
                }
              >
                {importResult.rowsImported} rows imported successfully
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                {importResult.errors.length} row(s) failed to import:
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-800 dark:text-red-200">
                {importResult.errors.map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Show loading
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Loading field suggestions...
          </span>
        </CardContent>
      </Card>
    )
  }

  // Show field mapping form
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Map Fields</CardTitle>
          <CardDescription>
            Confirm how each CSV column maps to {importType.replace('_', ' ')}{' '}
            fields. Required fields are marked with *
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Field Mapping Controls */}
          <div className="space-y-3">
            {headers.map((header) => (
              <div key={header} className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor={`field-${header}`} className="mb-1 block">
                    {header}
                  </Label>
                  <Select
                    value={mapping[header] || 'skip'}
                    onValueChange={(value) =>
                      handleMappingChange(
                        header,
                        value === 'skip' ? null : value,
                      )
                    }
                  >
                    <SelectTrigger id={`field-${header}`}>
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS_BY_IMPORT_TYPE[importType].map((opt) => (
                        <SelectItem
                          key={opt.value || 'skip'}
                          value={opt.value || 'skip'}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {/* Preview of mapped data */}
          {Object.values(mapping).some((v) => v !== null) &&
            preview.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preview
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                        {headers
                          .filter((h) => mapping[h] !== null)
                          .map((header) => (
                            <th
                              key={header}
                              className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300"
                            >
                              {header}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 3).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                        >
                          {headers
                            .filter((h) => mapping[h] !== null)
                            .map((header) => (
                              <td
                                key={`${idx}-${header}`}
                                className="px-3 py-2 text-gray-600 dark:text-gray-400"
                              >
                                {row[header] || '-'}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" disabled={isConfirming}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isConfirming}
          className="flex-1"
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            'Confirm & Import'
          )}
        </Button>
      </div>
    </div>
  )
}
