import { describe, expect, it } from 'vitest'

import {
  createConfiguredObjectStorage,
  MemoryObjectStorage,
  ObjectStorageConfigurationError,
} from './object-storage'

async function* chunks() {
  yield new TextEncoder().encode('item,qty\n')
  yield new TextEncoder().encode('Salmon,2\n')
}

describe('raw CSV object storage', () => {
  it('requires all S3-compatible storage settings', () => {
    expect(() => createConfiguredObjectStorage({})).toThrowError(
      ObjectStorageConfigurationError,
    )
  })

  it('stores and removes bytes without exposing a filesystem path', async () => {
    const storage = new MemoryObjectStorage()
    await storage.putObject({
      key: 'csv/location/upload.csv',
      body: chunks(),
      contentType: 'text/csv',
    })

    expect(
      new TextDecoder().decode(storage.objects.get('csv/location/upload.csv')),
    ).toBe('item,qty\nSalmon,2\n')

    const stored = await storage.getObject('csv/location/upload.csv')
    const bytes = []
    for await (const chunk of stored) bytes.push(chunk)
    expect(new TextDecoder().decode(bytes[0])).toBe('item,qty\nSalmon,2\n')

    await storage.deleteObject('csv/location/upload.csv')
    expect(storage.objects.has('csv/location/upload.csv')).toBe(false)
  })
})
