import { describe, it, expect } from 'vitest'
import { encryptKey, decryptKey, envKeyName, createKeyResolver } from './keys.js'

// 32 bytes base64
const SECRET = Buffer.alloc(32, 7).toString('base64')

describe('encrypt/decrypt', () => {
  it('round-trip 還原原文', () => {
    const enc = encryptKey('sk-test-123', SECRET)
    expect(enc).not.toContain('sk-test-123') // 密文不含明文
    expect(decryptKey(enc, SECRET)).toBe('sk-test-123')
  })
  it('每次加密的密文不同（隨機 IV）', () => {
    expect(encryptKey('x', SECRET)).not.toBe(encryptKey('x', SECRET))
  })
  it('竄改密文 → 解密拋錯（GCM 驗證）', () => {
    const enc = encryptKey('x', SECRET)
    const bad = enc.slice(0, -4) + 'AAAA'
    expect(() => decryptKey(bad, SECRET)).toThrow()
  })
  it('格式錯 → 拋錯', () => {
    expect(() => decryptKey('nope', SECRET)).toThrow()
  })
})

describe('envKeyName', () => {
  it('provider → {PROVIDER}_API_KEY', () => {
    expect(envKeyName('groq')).toBe('GROQ_API_KEY')
    expect(envKeyName('google')).toBe('GOOGLE_API_KEY')
  })
})

describe('createKeyResolver', () => {
  it('優先用 DB 加密金鑰', async () => {
    const enc = encryptKey('db-key', SECRET)
    const get = createKeyResolver({
      fetchEncrypted: async () => enc,
      encryptionSecret: SECRET,
      env: { GROQ_API_KEY: 'env-key' },
    })
    expect(await get('groq')).toBe('db-key')
  })
  it('DB 沒有 → 退回 env', async () => {
    const get = createKeyResolver({
      fetchEncrypted: async () => null,
      encryptionSecret: SECRET,
      env: { GROQ_API_KEY: 'env-key' },
    })
    expect(await get('groq')).toBe('env-key')
  })
  it('都沒有 → null（路由層跳過該候選）', async () => {
    const get = createKeyResolver({ fetchEncrypted: async () => null, encryptionSecret: SECRET, env: {} })
    expect(await get('groq')).toBeNull()
  })
  it('DB 解密失敗 → 退回 env（不致命）', async () => {
    const get = createKeyResolver({
      fetchEncrypted: async () => 'corrupt:data:here',
      encryptionSecret: SECRET,
      env: { GROQ_API_KEY: 'env-fallback' },
    })
    expect(await get('groq')).toBe('env-fallback')
  })
  it('快取：同 provider 只查一次', async () => {
    let calls = 0
    const get = createKeyResolver({
      fetchEncrypted: async () => {
        calls += 1
        return null
      },
      encryptionSecret: SECRET,
      env: { GROQ_API_KEY: 'k' },
    })
    await get('groq')
    await get('groq')
    expect(calls).toBe(1)
  })
})
