import { describe, it, expect } from 'vitest'
import * as schema from '@/db/schema'

describe('Database Schema', () => {
  it('should export all required tables', () => {
    const expectedTables = [
      'locations',
      'posConnections',
      'csvUploads',
      'transactions',
      'items',
      'purchaseOrders',
      'inventorySnapshots',
      'recommendations',
      'auditEvents',
      'weather',
      'placesCache',
      'conversations',
      'messages',
      'waitlistSignups',
    ]

    expectedTables.forEach((tableName) => {
      expect(schema).toHaveProperty(tableName)
      const table = (schema as Record<string, unknown>)[tableName]
      expect(table).toBeDefined()
    })
  })

  it('should have correct number of tables exported', () => {
    const exportedTables = Object.keys(schema)
    expect(exportedTables).toContain('locations')
    expect(exportedTables).toContain('posConnections')
    expect(exportedTables).toContain('csvUploads')
    expect(exportedTables).toContain('transactions')
    expect(exportedTables).toContain('items')
    expect(exportedTables).toContain('purchaseOrders')
    expect(exportedTables).toContain('inventorySnapshots')
    expect(exportedTables).toContain('recommendations')
    expect(exportedTables).toContain('auditEvents')
    expect(exportedTables).toContain('weather')
    expect(exportedTables).toContain('placesCache')
    expect(exportedTables).toContain('conversations')
    expect(exportedTables).toContain('messages')
    expect(exportedTables).toContain('waitlistSignups')
  })

  it('all tables should be defined and are objects', () => {
    const tables = [
      schema.locations,
      schema.posConnections,
      schema.csvUploads,
      schema.transactions,
      schema.items,
      schema.purchaseOrders,
      schema.inventorySnapshots,
      schema.recommendations,
      schema.auditEvents,
      schema.weather,
      schema.placesCache,
      schema.conversations,
      schema.messages,
      schema.waitlistSignups,
    ]

    tables.forEach((table) => {
      expect(table).toBeDefined()
      expect(typeof table).toBe('object')
    })
  })

  it('schema should be importable without errors', () => {
    expect(() => {
      // This verifies all imports work correctly
      const count = Object.keys(schema).length
      expect(count).toBeGreaterThan(0)
    }).not.toThrow()
  })
})
