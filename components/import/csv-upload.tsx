'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FieldMappingUI } from '@/components/import/field-mapping-ui'
import { captureAnalyticsEvent } from '@/lib/analytics-utils'

interface CSVUploadProps {
  locationId: string
  importType?: ImportType
  onUploadComplete?: (data: UploadResult) => void
}

export type ImportType =
  | 'transactions'
  | 'purchase_orders'
  | 'inventory_snapshots'

interface UploadResult {
  uploadId: string
  filename: string
  rowCount: number
  headers: string[]
  preview: Record<string, string>[]
  status: string
  importType: ImportType
}

export function CSVUpload({
  locationId,
  importType = 'transactions',
  onUploadComplete,
}: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setIsUploading(true)

      // Track CSV upload start event
      captureAnalyticsEvent('csv-upload-started', {
        fileSize: file.size,
        fileName: file.name,
      })

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('location_id', locationId)
        formData.append('import_type', importType)

        const response = await fetch('/api/csv/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Upload failed')
          return
        }

        // Track successful CSV upload
        captureAnalyticsEvent('csv-upload-completed', {
          rowCount: data.rowCount,
        })

        setUploadResult(data)
        setShowFieldMapping(true)
        onUploadComplete?.(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setIsUploading(false)
      }
    },
    [importType, locationId, onUploadComplete],
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  // Show field mapping UI
  if (showFieldMapping && uploadResult) {
    return (
      <div className="space-y-4">
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">
              {uploadResult.filename}
            </CardTitle>
            <CardDescription className="text-blue-800 dark:text-blue-200">
              {uploadResult.rowCount} rows, {uploadResult.headers.length}{' '}
              columns
            </CardDescription>
          </CardHeader>
        </Card>

        <FieldMappingUI
          uploadId={uploadResult.uploadId}
          headers={uploadResult.headers}
          preview={uploadResult.preview}
          importType={importType}
          onCancel={() => {
            setShowFieldMapping(false)
            setUploadResult(null)
            setError(null)
            fileInputRef.current?.click()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Drag and drop a CSV or TSV file, or click to browse (max 50MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-600'
            } ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              aria-label="Upload CSV file"
            />

            <div className="flex flex-col items-center justify-center text-center">
              {isUploading ? (
                <>
                  <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Uploading file...
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Drag and drop your file here
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    or click to select a file
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
