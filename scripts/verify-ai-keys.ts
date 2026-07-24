/**
 * AI 金鑰後台流程驗證（直連 DB，不需真金鑰）：
 * 後台存的加密金鑰，能被 createKeyResolver 從 ai_provider_keys 解密取回
 * → 證明「後台設定 → completeForUsage 取用」整條接得起來。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { encryptKey, createKeyResolver } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { serverEnv } from '@snowrealm/shared-types'

function assert(c: boolean, m: string) {
  if (!c) {
    console.error(`✗ ${m}`)
    process.exitCode = 1
    throw new Error(m)
  }
  console.log(`✓ ${m}`)
}

async function main() {
  const admin = createAdminClient()
  const secret = serverEnv().AI_KEY_ENCRYPTION_SECRET
  const plain = 'gsk_test_ABCDEF1234567890'

  try {
    // 模擬後台 PUT：加密存進 ai_provider_keys
    const encrypted = encryptKey(plain, secret)
    assert(!encrypted.includes(plain), '密文不含明文')
    await admin.from('ai_provider_keys').upsert(
      {
        provider: 'groq',
        api_key_encrypted: encrypted,
        enabled: true,
        budget_reset_at: new Date().toISOString().slice(0, 10),
      },
      { onConflict: 'provider' },
    )

    // 模擬 completeForUsage 取用：resolver 從 DB 解密
    const getKey = createKeyResolver({
      encryptionSecret: secret,
      env: {}, // 確保是走 DB 不是 env
      fetchEncrypted: async (provider) => {
        const { data } = await admin
          .from('ai_provider_keys')
          .select('api_key_encrypted, enabled')
          .eq('provider', provider)
          .maybeSingle()
        return data?.enabled ? data.api_key_encrypted : null
      },
    })

    const resolved = await getKey('groq')
    assert(resolved === plain, '後台存的金鑰能被 resolver 從 DB 解密取回')

    const missing = await getKey('anthropic')
    assert(missing === null, '沒設的 provider 回 null（router 會跳過該候選）')

    console.log('\n✅ AI 金鑰後台流程驗證通過（設定→加密→DB→解密→取用）')
  } finally {
    await admin.from('ai_provider_keys').delete().eq('provider', 'groq')
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
