import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { ProviderId } from './providers.js'

/**
 * 金鑰管理。見 docs/spec/12-ai-model-routing.md §7。
 *
 * 1. 優先讀 ai_provider_keys（DB，AES-256-GCM 加密，主金鑰在 AI_KEY_ENCRYPTION_SECRET）
 * 2. DB 沒有 → 退回環境變數 {PROVIDER}_API_KEY
 * 3. 都沒有 → 回 null，路由層跳過該候選繼續走（不拋錯）
 *
 * 第 3 點讓「只設兩把免費金鑰」也能完整運作。
 * 絕不可把任何金鑰傳給前端、寫進 log 或 error message。
 */

const IV_BYTES = 12

/** AES-256-GCM 加密。回傳 `iv:tag:ciphertext`（皆 base64）。 */
export function encryptKey(plaintext: string, secretBase64: string): string {
  const key = Buffer.from(secretBase64, 'base64')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** 解密。格式錯或竄改會拋錯（GCM 驗證失敗）。 */
export function decryptKey(encrypted: string, secretBase64: string): string {
  const [ivB64, tagB64, ctB64] = encrypted.split(':')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('金鑰密文格式錯誤')
  const key = Buffer.from(secretBase64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

export function envKeyName(provider: ProviderId): string {
  return `${provider.toUpperCase()}_API_KEY`
}

export type KeyResolverDeps = {
  /** 讀 ai_provider_keys.api_key_encrypted（enabled=true）；沒有回 null。 */
  fetchEncrypted: (provider: ProviderId) => Promise<string | null>
  encryptionSecret: string
  env?: Record<string, string | undefined>
}

/**
 * 建立 getProviderKey(provider)。快取每個 provider 的解析結果（同一次流程內）。
 */
export function createKeyResolver(deps: KeyResolverDeps): (provider: ProviderId) => Promise<string | null> {
  const env = deps.env ?? process.env
  const cache = new Map<ProviderId, string | null>()

  return async function getProviderKey(provider: ProviderId): Promise<string | null> {
    if (cache.has(provider)) return cache.get(provider) ?? null

    let key: string | null = null
    // 1. DB 加密金鑰
    const encrypted = await deps.fetchEncrypted(provider).catch(() => null)
    if (encrypted) {
      try {
        key = decryptKey(encrypted, deps.encryptionSecret)
      } catch {
        // 解密失敗不致命：當作沒有這把，退回 env
        key = null
      }
    }
    // 2. 環境變數
    if (!key) {
      const fromEnv = env[envKeyName(provider)]
      if (fromEnv) key = fromEnv
    }
    // 3. 都沒有 → null（路由層跳過）
    cache.set(provider, key)
    return key
  }
}
