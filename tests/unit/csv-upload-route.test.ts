/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/csv/upload/route'
import * as fs from 'fs'

// Mock only the dependencies that don't use dynamic imports
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: 'test-user' },
      }),
    },
  },
}))

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 'owned-location' }]),
      })),
    })),
  },
}))

vi.mock('@/lib/csv/parser', () => ({
  parseCSV: vi.fn(),
}))

import { db } from '@/db'
import { parseCSV } from '@/lib/csv/parser'
import { auth } from '@/lib/auth'

/**
 * Helper to create a mock request with properly named files
 * Uses vi.spyOn to mock request.formData() which preserves filename
 */
function createFormDataRequest(
  fileName: string,
  fileContent: string,
  locationId: string,
  fileMimeType: string = 'text/csv',
): NextRequest {
  const blob = new Blob([fileContent], { type: fileMimeType })
  const file = new File([blob], fileName, { type: fileMimeType })

  const request = new NextRequest('http://localhost:3000/api/csv/upload', {
    method: 'POST',
    body: new FormData(), // placeholder
  })

  // Mock formData() to return our constructed FormData with properly named file
  const mockFormData = new FormData()
  mockFormData.append('file', file)
  mockFormData.append('location_id', locationId)

  vi.spyOn(request, 'formData').mockResolvedValueOnce(mockFormData)

  return request
}

describe('CSV Upload Route - POST /api/csv/upload', () => {
  // Clean up any test upload directory before/after tests
  const TEST_UPLOAD_DIR = '/tmp/csv-uploads-test'
  beforeEach(() => {
    vi.clearAllMocks()
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true })
    }
  })

  describe('authorization', () => {
    it('should return 401 for an unauthenticated upload', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

      const request = createFormDataRequest(
        'sales.csv',
        'date,item,qty\n2026-01-01,Salmon,1\n',
        'loc-123',
      )
      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })

    it('should return 403 when the location is not owned by the user', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      } as any)

      const request = createFormDataRequest(
        'sales.csv',
        'date,item,qty\n2026-01-01,Salmon,1\n',
        'other-user-location',
      )
      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Missing File Tests
  // ============================================================================
  describe('File validation - missing file', () => {
    it('should return 400 when no file is attached', async () => {
      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: new FormData(),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Missing file')
    })

    it('should return 400 when file is missing but location_id is present', async () => {
      const formData = new FormData()
      formData.append('location_id', 'loc-123')

      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Missing file')
    })
  })

  // ============================================================================
  // Missing location_id Tests
  // ============================================================================
  describe('Form data validation - missing location_id', () => {
    it('should return 400 when no location_id in form data', async () => {
      const request = createFormDataRequest(
        'test.csv',
        'col1,col2\nval1,val2\n',
        '',
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('location_id')
    })

    it('should return 400 when location_id is missing entirely', async () => {
      const blob = new Blob(['col1,col2\nval1,val2\n'], { type: 'text/csv' })
      const file = new File([blob], 'test.csv', { type: 'text/csv' })

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('location_id')
    })
  })

  // ============================================================================
  // File Type Validation Tests
  // ============================================================================
  describe('File type validation', () => {
    it('should return 400 for non-CSV file extension (.exe)', async () => {
      const request = createFormDataRequest(
        'malware.exe',
        'malicious',
        'loc-123',
        'application/x-executable',
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid file type')
    })

    it('should return 400 for non-CSV file extension (.json)', async () => {
      const request = createFormDataRequest(
        'data.json',
        '{}',
        'loc-123',
        'application/json',
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid file type')
    })

    it('should return 400 for non-CSV file extension (.txt)', async () => {
      const request = createFormDataRequest(
        'data.txt',
        'text',
        'loc-123',
        'text/plain',
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid file type')
    })

    it('should return 400 for non-CSV file extension (.pdf)', async () => {
      const request = createFormDataRequest(
        'data.pdf',
        'pdf',
        'loc-123',
        'application/pdf',
      )

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid file type')
    })

    it('should accept .csv file extension when valid', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows: [{ col1: 'val1', col2: 'val2' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'col1,col2\nval1,val2\n',
        'loc-123',
      )
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept .tsv file extension when valid', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows: [{ col1: 'val1', col2: 'val2' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.tsv',
        'col1\tcol2\n',
        'loc-123',
        'text/tab-separated-values',
      )
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle uppercase .CSV extension (case-insensitive)', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows: [{ col1: 'val1', col2: 'val2' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.CSV',
        'col1,col2\n',
        'loc-123',
      )
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // File Size Validation Tests
  // ============================================================================
  describe('File size validation', () => {
    it('should return 413 for files exceeding 50MB', async () => {
      const oversizedFile = new File(['x'], 'large.csv', { type: 'text/csv' })
      Object.defineProperty(oversizedFile, 'size', { value: 51 * 1024 * 1024 })

      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: new FormData(),
      })

      const mockFormData = new FormData()
      mockFormData.append('file', oversizedFile)
      mockFormData.append('location_id', 'loc-123')
      vi.spyOn(request, 'formData').mockResolvedValueOnce(mockFormData)

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(413)
      expect(body.error).toContain('exceeds limit')
      expect(body.error).toContain('50MB')
    })

    it('should include accurate file size in error message', async () => {
      const oversizedFile = new File(['x'], 'large.csv', { type: 'text/csv' })
      Object.defineProperty(oversizedFile, 'size', { value: 75 * 1024 * 1024 })

      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: new FormData(),
      })

      const mockFormData = new FormData()
      mockFormData.append('file', oversizedFile)
      mockFormData.append('location_id', 'loc-123')
      vi.spyOn(request, 'formData').mockResolvedValueOnce(mockFormData)

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(413)
      expect(body.error).toContain('75.00MB')
    })

    it('should accept file exactly at 50MB limit', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows: [{ col1: 'val1', col2: 'val2' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const largeFile = new File(['x'], 'test.csv', { type: 'text/csv' })
      Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 })

      const request = new NextRequest('http://localhost:3000/api/csv/upload', {
        method: 'POST',
        body: new FormData(),
      })

      const mockFormData = new FormData()
      mockFormData.append('file', largeFile)
      mockFormData.append('location_id', 'loc-123')
      vi.spyOn(request, 'formData').mockResolvedValueOnce(mockFormData)

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('should accept small files', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows: [{ col1: 'val1', col2: 'val2' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'col1,col2\nval1,val2\n',
        'loc-123',
      )
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // Successful Upload Tests
  // ============================================================================
  describe('Successful file upload', () => {
    it('should return 200 with correct response structure', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['name', 'qty', 'price'],
        rows: [{ name: 'Item', qty: '10', price: '20.00' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'upload-uuid',
              filename: 'inventory.csv',
              status: 'pending',
            },
          ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'inventory.csv',
        'name,qty,price\n',
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toHaveProperty('uploadId')
      expect(body).toHaveProperty('filename')
      expect(body).toHaveProperty('rowCount')
      expect(body).toHaveProperty('headers')
      expect(body).toHaveProperty('preview')
      expect(body).toHaveProperty('status')
    })

    it('should return uploadId from database', async () => {
      const mockRowCount = 1

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: mockRowCount,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(body.rowCount).toBe(mockRowCount)
    })

    it('should return headers from parser', async () => {
      const mockHeaders = ['product', 'quantity', 'price']

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: mockHeaders,
        rows: [{ product: 'Item', quantity: '5', price: '10' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'product,quantity,price\n',
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(body.headers).toEqual(mockHeaders)
    })

    it('should return preview rows (limited to 10)', async () => {
      const mockRows = Array.from({ length: 5 }, (_, i) => ({
        col: `val${i}`,
      }))

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: mockRows,
        totalRows: 1000,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(body.preview).toEqual(mockRows)
      expect(body.preview.length).toBeLessThanOrEqual(10)
    })

    it('should return status "pending"', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\nval\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(body.status).toBe('pending')
    })
  })

  // ============================================================================
  // Database Record Creation Tests
  // ============================================================================
  describe('Database record creation', () => {
    it('should call db.insert', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\nval\n', 'loc-123')
      await POST(request)

      expect(vi.mocked(db.insert)).toHaveBeenCalled()
    })

    it('should insert with correct locationId', async () => {
      const mockLocationId = 'loc-456'

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      const mockValues = vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'id', filename: 'test.csv', status: 'pending' },
          ]),
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockValues,
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'col\nval\n',
        mockLocationId,
      )
      await POST(request)

      const insertedValues = mockValues.mock.calls[0][0]
      expect(insertedValues.locationId).toBe(mockLocationId)
    })

    it('should insert with filename from upload', async () => {
      const mockFilename = 'products.csv'

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      const mockValues = vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'id', filename: mockFilename, status: 'pending' },
          ]),
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockValues,
      } as any)

      const request = createFormDataRequest(
        mockFilename,
        'col\nval\n',
        'loc-123',
      )
      await POST(request)

      const insertedValues = mockValues.mock.calls[0][0]
      expect(insertedValues.filename).toBe(mockFilename)
    })

    it('should insert with rowCount', async () => {
      const mockRowCount = 100

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: Array(10).fill({ col: 'val' }),
        totalRows: mockRowCount,
      })

      const mockValues = vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'id', filename: 'test.csv', status: 'pending' },
          ]),
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockValues,
      } as any)

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      await POST(request)

      const insertedValues = mockValues.mock.calls[0][0]
      expect(insertedValues.rowCount).toBe(mockRowCount)
    })

    it('should insert with status pending', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      const mockValues = vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'id', filename: 'test.csv', status: 'pending' },
          ]),
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockValues,
      } as any)

      const request = createFormDataRequest('test.csv', 'col\nval\n', 'loc-123')
      await POST(request)

      const insertedValues = mockValues.mock.calls[0][0]
      expect(insertedValues.status).toBe('pending')
    })

    it('should insert with fieldMapping containing headers', async () => {
      const mockHeaders = ['product', 'qty']

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: mockHeaders,
        rows: [{ product: 'Item', qty: '5' }],
        totalRows: 1,
      })

      const mockValues = vi.fn().mockReturnValueOnce({
        returning: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 'id', filename: 'test.csv', status: 'pending' },
          ]),
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: mockValues,
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'product,qty\n',
        'loc-123',
      )
      await POST(request)

      const insertedValues = mockValues.mock.calls[0][0]
      expect(insertedValues.fieldMapping).toBeDefined()
      expect(typeof insertedValues.fieldMapping).toBe('string')

      const mapping = JSON.parse(insertedValues.fieldMapping)
      expect(mapping.headers).toEqual(mockHeaders)
    })
  })

  // ============================================================================
  // CSV Parsing Tests
  // ============================================================================
  describe('CSV parsing', () => {
    it('should call parseCSV with file buffer', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\nval\n', 'loc-123')
      await POST(request)

      expect(vi.mocked(parseCSV)).toHaveBeenCalled()
    })

    it('should return 400 on CSV parsing error', async () => {
      vi.mocked(parseCSV).mockRejectedValueOnce(
        new Error('CSV parsing error: Bad format'),
      )

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid CSV file')
    })

    it('should return 400 on "Failed to parse" error', async () => {
      vi.mocked(parseCSV).mockRejectedValueOnce(
        new Error('Failed to parse CSV: encoding issue'),
      )

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid CSV file')
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error handling', () => {
    it('should return 500 on database error', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new Error('DB error')),
        }),
      } as any)

      const request = createFormDataRequest('test.csv', 'col\nval\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBeDefined()
    })

    it('should return 500 on unexpected error', async () => {
      vi.mocked(parseCSV).mockRejectedValueOnce(
        new Error('Unexpected: something broke'),
      )

      const request = createFormDataRequest('test.csv', 'col\n', 'loc-123')
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toContain('Failed to process CSV file')
    })
  })

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================
  describe('Edge cases', () => {
    it('should handle filename with special characters', async () => {
      const specialName = 'data_2024-01-15 (final).csv'

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col'],
        rows: [{ col: 'val' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'upload-123', filename: specialName, status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        specialName,
        'col\nval\n',
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.filename).toBe(specialName)
    })

    it('should handle CSV with single column', async () => {
      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['product'],
        rows: [{ product: 'Item' }],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'product\nItem\n',
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.headers.length).toBe(1)
    })

    it('should handle CSV with many columns', async () => {
      const manyHeaders = Array.from({ length: 50 }, (_, i) => `col${i + 1}`)

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: manyHeaders,
        rows: [Object.fromEntries(manyHeaders.map((h) => [h, 'val']))],
        totalRows: 1,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        manyHeaders.join(','),
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.headers.length).toBe(50)
    })

    it('should limit preview to 10 rows maximum', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        col1: `v${i}`,
        col2: `d${i}`,
      }))

      vi.mocked(parseCSV).mockResolvedValueOnce({
        headers: ['col1', 'col2'],
        rows,
        totalRows: 1000,
      })

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 'id', filename: 'test.csv', status: 'pending' },
            ]),
        }),
      } as any)

      const request = createFormDataRequest(
        'test.csv',
        'col1,col2\n',
        'loc-123',
      )
      const response = await POST(request)
      const body = await response.json()

      expect(body.preview.length).toBe(10)
      expect(body.rowCount).toBe(1000)
    })
  })
})
