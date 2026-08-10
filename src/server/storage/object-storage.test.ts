import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createConfiguredObjectStorage,
  FileSystemObjectStorage,
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

  it('persists the opt-in browser-test store across storage instances', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pantryiq-storage-'))
    try {
      const first = new FileSystemObjectStorage(root)
      await first.putObject({
        key: 'csv/location/upload.csv',
        body: chunks(),
        contentType: 'text/csv',
      })

      const second = new FileSystemObjectStorage(root)
      const stored = await second.getObject('csv/location/upload.csv')
      const bytes = []
      for await (const chunk of stored) bytes.push(chunk)
      expect(new TextDecoder().decode(bytes[0])).toBe('item,qty\nSalmon,2\n')
      await expect(second.getObject('../outside.csv')).rejects.toThrow(
        'Object storage key escaped its root.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
