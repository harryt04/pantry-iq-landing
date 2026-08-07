import { NextRequest, NextResponse } from 'next/server'
import { parseCSV } from '@/lib/csv/parser'
import { readCSVFile, deleteCSVFile } from '@/lib/csv/storage'
import {
  suggestMappings,
  validateMapping,
  applyMapping,
  FieldMapping,
} from '@/lib/csv/field-mapper'
import { db } from '@/db'
import { csvUploads } from '@/db/schema/csv-uploads'
import { transactions } from '@/db/schema/transactions'
import { purchaseOrders } from '@/db/schema/purchase-orders'
import { inventorySnapshots } from '@/db/schema/inventory-snapshots'
import { locations } from '@/db/schema/locations'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'

interface FieldMappingRequest {
  uploadId: string
  confirmedMapping?: FieldMapping
}

interface ImportError {
  row: number
  message: string
}

interface FieldMappingResponse {
  success: boolean
  rowsImported?: number
  errors?: ImportError[]
  mapping?: FieldMapping
  suggestedMapping?: FieldMapping
  message?: string
}

/**
 * POST /api/csv/field-mapping
 *
 * Handles field mapping confirmation and CSV data import
 *
 * Request body:
 * - uploadId: UUID of the CSV upload
 * - confirmedMapping: (optional) User-confirmed field mapping
 *
 * Returns:
 * - 200: { success, rowsImported, errors, mapping }
 * - 400: Bad request
 * - 404: Upload not found
 * - 500: Server error
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<FieldMappingResponse>> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body: FieldMappingRequest = await request.json()
    const { uploadId, confirmedMapping } = body

    if (!uploadId) {
      return NextResponse.json(
        { success: false, message: 'Missing uploadId' },
        { status: 400 },
      )
    }

    // Get the upload record
    const uploadRecords = await db
      .select()
      .from(csvUploads)
      .where(eq(csvUploads.id, uploadId))

    if (uploadRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Upload not found' },
        { status: 404 },
      )
    }

    const upload = uploadRecords[0]

    const ownedLocation = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, upload.locationId),
          eq(locations.userId, session.user.id),
        ),
      )

    if (ownedLocation.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 },
      )
    }

    // If no confirmed mapping provided, generate suggestions
    if (!confirmedMapping) {
      // Update status to 'mapping'
      await db
        .update(csvUploads)
        .set({ status: 'mapping' })
        .where(eq(csvUploads.id, uploadId))

      // Read the uploaded CSV file from temp storage
      // In production, this would be retrieved from object storage
      // For now, we'll return suggested mappings based on headers
      let sampleData: Record<string, string>[] = []
      try {
        const fileBuffer = await readCSVFile(uploadId)
        const parsed = await parseCSV(fileBuffer, { maxPreviewRows: 5 })
        sampleData = parsed.rows
      } catch (error) {
        console.error('Failed to read CSV file for suggestions:', error)
        // Continue with empty sample
      }

      // Get suggested mappings
      interface FieldHeaders {
        headers?: string[]
      }
      let mappingData: FieldHeaders = {}
      if (upload.fieldMapping) {
        try {
          mappingData = JSON.parse(
            typeof upload.fieldMapping === 'string'
              ? upload.fieldMapping
              : JSON.stringify(upload.fieldMapping),
          )
        } catch {
          console.error('Failed to parse fieldMapping from upload record')
        }
      }
      const suggestedMapping = await suggestMappings(
        mappingData.headers || [],
        sampleData,
        upload.importType as Parameters<typeof suggestMappings>[2],
      )

      return NextResponse.json(
        {
          success: true,
          suggestedMapping,
          message: 'Field mapping suggestions generated',
        },
        { status: 200 },
      )
    }

    // Validate the confirmed mapping
    const requiredFields =
      upload.importType === 'inventory_snapshots'
        ? ['item', 'date', 'qtyOnHand']
        : ['item', 'date', 'qty']
    const validationError = validateMapping(
      confirmedMapping,
      requiredFields as Parameters<typeof validateMapping>[1],
    )
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 },
      )
    }

    // Update status to 'importing'
    await db
      .update(csvUploads)
      .set({
        status: 'importing',
        fieldMapping: JSON.stringify(confirmedMapping),
      })
      .where(eq(csvUploads.id, uploadId))

    // Read the CSV file
    let fileBuffer: Buffer
    try {
      fileBuffer = await readCSVFile(uploadId)
    } catch {
      await db
        .update(csvUploads)
        .set({
          status: 'error',
          errorDetails: 'CSV file not found',
        })
        .where(eq(csvUploads.id, uploadId))

      return NextResponse.json(
        { success: false, message: 'CSV file not found' },
        { status: 400 },
      )
    }

    // Parse the CSV with full data
    const parsed = await parseCSV(fileBuffer, { fullParse: true })

    // Apply mapping and import data
    const errors: ImportError[] = []
    let successCount = 0

    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex++) {
      try {
        const row = parsed.rows[rowIndex]
        const normalized = applyMapping(row, confirmedMapping)

        // Validate required fields
        if (!normalized.item) {
          errors.push({
            row: rowIndex + 1,
            message: 'Missing required field: item',
          })
          continue
        }

        if (!normalized.date) {
          errors.push({
            row: rowIndex + 1,
            message: 'Missing or invalid date',
          })
          continue
        }

        if (normalized.qty === null) {
          errors.push({
            row: rowIndex + 1,
            message: 'Missing or invalid quantity',
          })
          continue
        }

        if (upload.importType === 'transactions') {
          await db.insert(transactions).values({
            locationId: upload.locationId,
            date: String(normalized.date),
            item: String(normalized.item),
            qty: String(normalized.qty),
            revenue:
              normalized.revenue != null ? String(normalized.revenue) : null,
            cost: normalized.cost != null ? String(normalized.cost) : null,
            source: 'csv',
            sourceId: uploadId,
          })
        } else if (upload.importType === 'purchase_orders') {
          const unitCost = normalized.unitCost ?? normalized.cost
          await db.insert(purchaseOrders).values({
            locationId: upload.locationId,
            purchaseDate: String(normalized.date),
            item: String(normalized.item),
            qty: String(normalized.qty),
            unitCost: unitCost != null ? String(unitCost) : null,
            totalCost:
              unitCost != null
                ? String(Number(normalized.qty) * Number(unitCost))
                : null,
            supplier: normalized.supplier ? String(normalized.supplier) : null,
            deliveryDate: normalized.deliveryDate
              ? String(normalized.deliveryDate)
              : null,
            source: 'csv',
            sourceId: uploadId,
          })
        } else if (upload.importType === 'inventory_snapshots') {
          await db.insert(inventorySnapshots).values({
            locationId: upload.locationId,
            snapshotDate: String(normalized.date),
            item: String(normalized.item),
            qtyOnHand: String(normalized.qtyOnHand),
            snapshotType: normalized.snapshotType
              ? String(normalized.snapshotType)
              : 'count',
            source: 'csv',
            sourceId: uploadId,
          })
        }

        successCount++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({
          row: rowIndex + 1,
          message: `Import failed: ${message}`,
        })
      }
    }

    // Update status to complete or error
    const finalStatus =
      errors.length === 0
        ? 'complete'
        : successCount > 0
          ? 'complete' // Partial success — some rows imported
          : 'error' // Total failure — zero rows imported
    const errorDetails = errors.length > 0 ? JSON.stringify(errors) : null

    await db
      .update(csvUploads)
      .set({
        status: finalStatus,
        errorDetails,
      })
      .where(eq(csvUploads.id, uploadId))

    // Clean up temp file
    try {
      await deleteCSVFile(uploadId)
    } catch (error) {
      console.warn('Failed to delete temp CSV file:', error)
    }

    return NextResponse.json(
      {
        success: errors.length === 0,
        rowsImported: successCount,
        errors: errors.length > 0 ? errors : undefined,
        mapping: confirmedMapping,
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Field mapping API error:', error)

    return NextResponse.json(
      { success: false, message: `Error: ${message}` },
      { status: 500 },
    )
  }
}

/**
 * GET /api/csv/field-mapping
 *
 * Get suggested field mappings for an upload
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json(
        { success: false, message: 'Missing uploadId parameter' },
        { status: 400 },
      )
    }

    const uploadRecords = await db
      .select()
      .from(csvUploads)
      .where(eq(csvUploads.id, uploadId))

    if (uploadRecords.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Upload not found' },
        { status: 404 },
      )
    }

    const upload = uploadRecords[0]

    const ownedLocation = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, upload.locationId),
          eq(locations.userId, session.user.id),
        ),
      )

    if (ownedLocation.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 },
      )
    }

    // If mapping already confirmed, return it
    if (upload.fieldMapping) {
      return NextResponse.json({
        success: true,
        mapping: upload.fieldMapping,
        alreadyMapped: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Upload found, call POST to generate suggestions',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Field mapping GET error:', error)

    return NextResponse.json(
      { success: false, message: `Error: ${message}` },
      { status: 500 },
    )
  }
}
