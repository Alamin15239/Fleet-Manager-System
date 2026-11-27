import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

type UploadOptions = {
  organizationId: string
  module: string
  entityId?: string
  fileName: string
  contentType: string
  body: Buffer | Uint8Array
}

let client: S3Client | null = null

function getStorageConfig() {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Object storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.')
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey }
}

function getClient() {
  if (client) return client
  const config = getStorageConfig()
  client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return client
}

function safeSegment(value: string) {
  const normalized = value.normalize('NFKC').trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('Invalid object storage path segment')
  return normalized.slice(0, 100)
}

export function createOrganizationObjectKey(input: Pick<UploadOptions, 'organizationId' | 'module' | 'entityId' | 'fileName'>) {
  const extension = input.fileName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() || 'bin'
  return [
    'organizations',
    safeSegment(input.organizationId),
    safeSegment(input.module),
    input.entityId ? safeSegment(input.entityId) : 'general',
    randomUUID() + '.' + extension,
  ].join('/')
}

export async function putOrganizationObject(input: UploadOptions) {
  const config = getStorageConfig()
  const key = createOrganizationObjectKey(input)
  await getClient().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.body,
    ContentType: input.contentType,
    ContentLength: input.body.byteLength,
    CacheControl: 'private, no-store',
    Metadata: {
      organization: safeSegment(input.organizationId),
      module: safeSegment(input.module),
    },
  }))
  return { key, size: input.body.byteLength, contentType: input.contentType }
}

export async function getOrganizationObject(key: string) {
  const config = getStorageConfig()
  if (!key.startsWith('organizations/')) throw new Error('Invalid object storage key')
  const response = await getClient().send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
  if (!response.Body) throw new Error('Stored object has no content')
  const body = await response.Body.transformToByteArray()
  return {
    body: Buffer.from(body),
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength ?? body.byteLength,
  }
}

export async function deleteOrganizationObject(key: string) {
  const config = getStorageConfig()
  if (!key.startsWith('organizations/')) throw new Error('Invalid object storage key')
  await getClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export function isOrganizationObjectKey(value: string | null | undefined, organizationId?: string | null): value is string {
  if (typeof value !== 'string' || !value.startsWith('organizations/')) return false
  if (!organizationId) return false
  try {
    return value.startsWith('organizations/' + safeSegment(organizationId) + '/')
  } catch {
    return false
  }
}

export function profileImageDisplayUrl(value: string | null | undefined) {
  return value?.startsWith('s3://') ? '/api/profile/picture' : value ?? null
}
