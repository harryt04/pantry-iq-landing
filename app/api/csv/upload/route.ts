import { NextRequest, NextResponse } from 'next/server'
import { parseCSV } from '@/lib/csv/parser'
import { writeCSVFile, ensureUploadDir } from '@/lib/csv/storage'
import { db } from '@/db'
import { csvUploads } from '@/db/schema/csv-uploads'
import { locations } from '@/db/schema/locations'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * POST /api/csv/upload
 *
 * Accepts multipart/form-data with:
 * - file: CSV or TSV file
 * - location_id: UUID of the location
 *
 * Returns:
 * - 200: { uploadId, filename, rowCount, headers, preview, status }
 * - 400: Bad request (missing file or location_id, invalid file type)
 * - 413: Payload too large (file exceeds 50MB)
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const locationId = formData.get('location_id') as string | null
    const importType =
      (formData.get('import_type') as string | null) || 'transactions'

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'Missing file in request' },
        { status: 400 },
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'Missing location_id in request' },
        { status: 400 },
      )
    }

    if (
      !['transactions', 'purchase_orders', 'inventory_snapshots'].includes(
        importType,
      )
    ) {
      return NextResponse.json(
        { error: 'Invalid import_type' },
        { status: 400 },
      )
    }

    // Validate file type
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.csv') && !filename.endsWith('.tsv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .csv and .tsv files are accepted.' },
        { status: 400 },
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds limit. Maximum size is 50MB, but file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        },
        { status: 413 },
      )
    }

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownedLocation = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.userId, session.user.id),
        ),
      )

    if (ownedLocation.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse CSV
    const parsed = await parseCSV(buffer)

    // Create CSV upload record in database
    const [uploadRecord] = await db
      .insert(csvUploads)
      .values({
        locationId,
        filename: file.name,
        importType,
        rowCount: parsed.totalRows,
        status: 'pending',
        fieldMapping: JSON.stringify({ headers: parsed.headers }),
      })
      .returning()

    // Store file for later processing
    await ensureUploadDir()
    try {
      await writeCSVFile(uploadRecord.id, buffer)
    } catch (error) {
      console.warn('Failed to store CSV file:', error)
      // Continue anyway - we have the preview data
    }

    return NextResponse.json(
      {
        uploadId: uploadRecord.id,
        filename: uploadRecord.filename,
        rowCount: parsed.totalRows,
        headers: parsed.headers,
        preview: parsed.rows,
        importType: uploadRecord.importType,
        status: uploadRecord.status,
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Check if it's a parsing error (typically indicates malformed CSV)
    if (
      message.includes('CSV parsing error') ||
      message.includes('Failed to parse CSV')
    ) {
      return NextResponse.json(
        { error: `Invalid CSV file: ${message}` },
        { status: 400 },
      )
    }

    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process CSV file. Please try again.' },
      { status: 500 },
    )
  }
}
