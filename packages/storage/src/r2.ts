import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serverEnv } from '@snowrealm/shared-types'
import type { StorageAdapter, PutIntent, ObjectHead } from './adapter.js'

const UPLOAD_URL_TTL_SECONDS = 600 // ADR-022：10 分鐘
const DOWNLOAD_URL_TTL_SECONDS = 900 // ADR-022：15 分鐘

let cachedClient: S3Client | null = null

function client(): S3Client {
  if (cachedClient) return cachedClient
  const env = serverEnv()
  cachedClient = new S3Client({
    region: env.R2_REGION,
    // R2_ENDPOINT 讓本機開發可以指向 S3 相容的本地服務，
    // 不必為了跑起專案去申請 Cloudflare 帳號（11-engineering-setup.md §12）。
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: env.R2_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
  return cachedClient
}

function bucket(): string {
  return serverEnv().R2_BUCKET
}

async function streamToBytes(body: unknown): Promise<Uint8Array> {
  const stream = body as { transformToByteArray?: () => Promise<Uint8Array> }
  if (typeof stream?.transformToByteArray === 'function') {
    return stream.transformToByteArray()
  }
  throw new Error('無法讀取物件內容：非預期的 body 型別')
}

export class R2StorageAdapter implements StorageAdapter {
  async createUploadUrl(input: {
    key: string
    contentType: string
    contentLength: number
    expiresInSeconds?: number
  }): Promise<PutIntent> {
    const expiresIn = input.expiresInSeconds ?? UPLOAD_URL_TTL_SECONDS

    // ContentLength 納入簽章 —— 客戶端無法上傳比宣稱更大的檔案來繞過配額。
    const command = new PutObjectCommand({
      Bucket: bucket(),
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    })

    const url = await getSignedUrl(client(), command, { expiresIn })

    return {
      key: input.key,
      contentType: input.contentType,
      contentLength: input.contentLength,
      requiredHeaders: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.contentLength),
      },
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    }
  }

  async createDownloadUrl(input: { key: string; expiresInSeconds?: number }): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket(), Key: input.key })
    return getSignedUrl(client(), command, {
      expiresIn: input.expiresInSeconds ?? DOWNLOAD_URL_TTL_SECONDS,
    })
  }

  async head(key: string): Promise<ObjectHead | null> {
    try {
      const res = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
      return {
        key,
        bytes: res.ContentLength ?? 0,
        contentType: res.ContentType ?? null,
        etag: res.ETag ?? null,
        lastModified: res.LastModified ?? null,
      }
    } catch (err: unknown) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
    return streamToBytes(res.Body)
  }

  async put(input: {
    key: string
    body: Uint8Array
    contentType: string
    cacheControl?: string
  }): Promise<void> {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.cacheControl ? { CacheControl: input.cacheControl } : {}),
      }),
    )
  }

  async delete(key: string): Promise<void> {
    // 刪除不存在的 key 在 S3 語意下就是成功，天然冪等。
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
  }

  async deleteMany(keys: string[]): Promise<{ failed: string[] }> {
    if (keys.length === 0) return { failed: [] }

    const failed: string[] = []
    // S3 DeleteObjects 單次上限 1000
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000)
      const res = await client().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      )
      for (const e of res.Errors ?? []) {
        if (e.Key) failed.push(e.Key)
      }
    }
    return { failed }
  }

  async list(prefix: string, limit = 1000): Promise<string[]> {
    const keys: string[] = []
    let token: string | undefined

    do {
      const res = await client().send(
        new ListObjectsV2Command({
          Bucket: bucket(),
          Prefix: prefix,
          ContinuationToken: token,
          MaxKeys: Math.min(1000, limit - keys.length),
        }),
      )
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key)
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token && keys.length < limit)

    return keys
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404
}

let cachedAdapter: StorageAdapter | null = null

export function storage(): StorageAdapter {
  cachedAdapter ??= new R2StorageAdapter()
  return cachedAdapter
}

/** 測試用：注入替身。 */
export function setStorageAdapter(adapter: StorageAdapter | null): void {
  cachedAdapter = adapter
}
