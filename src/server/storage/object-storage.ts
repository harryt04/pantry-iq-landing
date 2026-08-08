import { Readable } from 'node:stream'

import {
  DeleteObjectCommand,
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
}

export type ObjectStorageEnvironment = {
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
}
