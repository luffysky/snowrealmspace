import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 站台管理員的 secret 紀錄本。
 *
 * 值一律 AES-256-GCM 加密後才進 DB（主金鑰在 env，不在 DB）。全域資源，走 service role +
 * checkSiteAdmin 雙閘門（表 RLS 無 policy → 只有 service role 能存取）。
 * 列表不含值；值只在明確 reveal（GET ?id=）時才解密回傳。
 */

const IV_BYTES = 12

/** 32-byte 主金鑰（base64）。優先權杖加密金鑰，退回 AI 加密主金鑰。 */
function masterKey(): Buffer | null {
  const b64 = process.env['TOKEN_ENCRYPTION_SECRET'] || process.env['AI_KEY_ENCRYPTION_SECRET']
  if (!b64) return null
  const key = Buffer.from(b64, 'base64')
  return key.length === 32 ? key : null
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

function decrypt(encrypted: string, key: Buffer): string {
  const [ivB64, tagB64, ctB64] = encrypted.split(':')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('密文格式錯誤')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/** 列表（不含值）；帶 ?id= 則解密回傳單筆的值（reveal）。 */
export const GET = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const admin = createAdminClient()
  const id = new URL(request.url).searchParams.get('id')

  if (id) {
    const key = masterKey()
    if (!key) return fail('UNPROCESSABLE', '未設定 32-byte 加密金鑰，無法解密。')
    const { data, error } = await admin
      .from('admin_secret_notes')
      .select('id, value_encrypted')
      .eq('id', id)
      .maybeSingle()
    if (error) return fail('INTERNAL', '讀取失敗。')
    if (!data) return fail('NOT_FOUND', '找不到這筆紀錄。')
    let value: string
    try {
      value = decrypt(data.value_encrypted, key)
    } catch {
      return fail('INTERNAL', '解密失敗（加密金鑰可能換過）。')
    }
    return ok({ id, value })
  }

  const { data, error } = await admin
    .from('admin_secret_notes')
    .select('id, label, purpose, length_bytes, encoding, created_at')
    .order('created_at', { ascending: false })
  if (error) return fail('INTERNAL', '無法載入紀錄。')
  return ok(data ?? [])
})

const createSchema = z
  .object({
    label: z.string().trim().min(1, '請填標籤').max(120, '標籤最多 120 字'),
    purpose: z.string().trim().max(500).optional(),
    value: z.string().min(1, '沒有值可儲存').max(8192),
    lengthBytes: z.number().int().positive().max(8192).optional(),
    encoding: z.string().max(40).optional(),
  })
  .strict()

/** 新增一筆（值加密後存）。 */
export const POST = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const key = masterKey()
  if (!key) {
    return fail('UNPROCESSABLE', '未設定 32-byte 加密主金鑰（TOKEN/加密主金鑰），無法加密儲存。請先在 env 設好。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_secret_notes')
    .insert({
      label: parsed.data.label,
      purpose: parsed.data.purpose ?? null,
      length_bytes: parsed.data.lengthBytes ?? null,
      encoding: parsed.data.encoding ?? null,
      value_encrypted: encrypt(parsed.data.value, key),
      created_by: gate.userId,
    } as never)
    .select('id, label, purpose, length_bytes, encoding, created_at')
    .maybeSingle()
  if (error) return fail('INTERNAL', '儲存失敗。')
  return ok(data)
})

/** 刪除一筆（?id=）。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return fail('VALIDATION_FAILED', '缺少 id。')

  const admin = createAdminClient()
  const { error } = await admin.from('admin_secret_notes').delete().eq('id', id)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ id })
})
