import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { Readable } from 'node:stream'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

export type ObjectStoragePutInput = {
  key: string
  body: AsyncIterable<Uint8Array>
  contentType: string
}

export interface ObjectStorage {
  putObject(input: ObjectStoragePutInput): Promise<void>
  deleteObject(key: string): Promise<void>
  getObject(key: string): Promise<AsyncIterable<Uint8Array>>
}

export class ObjectStorageConfigurationError extends Error {
  constructor() {
    super('File storage is not configured.')
    this.name = 'ObjectStorageConfigurationError'
  }
}

export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: Readable.from(input.body),
        ContentType: input.contentType,
      }),
    )
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async getObject(key: string): Promise<AsyncIterable<Uint8Array>> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (!response.Body) throw new Error('Stored CSV has no readable body.')

    return (async function* () {
      for await (const chunk of response.Body as AsyncIterable<
        Uint8Array | string
      >) {
        yield typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : chunk
      }
    })()
  }
}

export type ObjectStorageEnvironment = {
  PANTRYIQ_E2E?: string
  PANTRYIQ_E2E_STORAGE_DIR?: string
  S3_ENDPOINT?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_BUCKET?: string
  S3_REGION?: string
  S3_FORCE_PATH_STYLE?: string
}

export function createConfiguredObjectStorage(
  environment: ObjectStorageEnvironment = process.env as ObjectStorageEnvironment,
): ObjectStorage {
  if (environment.PANTRYIQ_E2E === '1') {
    return new FileSystemObjectStorage(
      environment.PANTRYIQ_E2E_STORAGE_DIR ??
        join(process.cwd(), '.tmp', 'pantryiq-e2e-storage'),
    )
  }

  const endpoint = environment.S3_ENDPOINT
  const accessKeyId = environment.S3_ACCESS_KEY_ID
  const secretAccessKey = environment.S3_SECRET_ACCESS_KEY
  const bucket = environment.S3_BUCKET

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new ObjectStorageConfigurationError()
  }

  return new S3ObjectStorage(
    new S3Client({
      endpoint,
      region: environment.S3_REGION ?? 'auto',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: environment.S3_FORCE_PATH_STYLE === '1',
      // Some self-hosted S3-compatible servers (e.g. MinIO) don't handle
      // the SDK's default flexible-checksum aws-chunked streaming, which
      // fails as a non-retryable error mid-upload.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    }),
    bucket,
  )
}

export class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>()

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    const chunks: Uint8Array[] = []
    for await (const chunk of input.body) chunks.push(chunk)

    const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const object = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      object.set(chunk, offset)
      offset += chunk.length
    }
    this.objects.set(input.key, object)
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key)
  }

  async getObject(key: string): Promise<AsyncIterable<Uint8Array>> {
    const object = this.objects.get(key)
    if (!object) throw new Error('Stored CSV was not found.')
    return (async function* () {
      yield object
    })()
  }
}

export class FileSystemObjectStorage implements ObjectStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private pathFor(key: string) {
    const destination = resolve(this.root, key)
    const outsideRoot = relative(this.root, destination)
    if (
      !outsideRoot ||
      outsideRoot.startsWith(
        `..${process.platform === 'win32' ? '\\' : '/'}`,
      ) ||
      isAbsolute(outsideRoot)
    ) {
      throw new Error('Object storage key escaped its root.')
    }
    return destination
  }

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    const destination = this.pathFor(input.key)
    const chunks: Uint8Array[] = []
    for await (const chunk of input.body) chunks.push(chunk)
    const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const object = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      object.set(chunk, offset)
      offset += chunk.length
    }
    await mkdir(resolve(destination, '..'), { recursive: true })
    await writeFile(destination, object)
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  async getObject(key: string): Promise<AsyncIterable<Uint8Array>> {
    const object = new Uint8Array(await readFile(this.pathFor(key)))
    return (async function* () {
      yield object
    })()
  }
}
