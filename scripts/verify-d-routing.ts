/**
 * D 路由層整合驗證（直連 DB，不需 AI 金鑰）。
 *
 * 本機沒設任何 AI 金鑰時，completeForUsage 應該：
 *   - 正常查到候選鏈（getCandidates 讀 ai_usage_models）
 *   - 通過預算閘門（budget 讀 ai_daily_quota）
 *   - 每個候選因缺金鑰被跳過（getKey 回 null）
 *   - 最後拋 AllCandidatesFailedError（誠實失敗，不假裝有答案）
 *
 * 這證明 buildCompleteDeps 把 completeForUsage 正確接上真 Supabase。
 * 設了金鑰後，同一條路徑就會真的呼叫模型。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { completeForUsage, AllCandidatesFailedError, QuotaExceededError } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { buildCompleteDeps } from '../apps/web/lib/ai/deps.js'

async function main() {
  // 確保本機沒有殘留金鑰污染這個測試
  for (const k of Object.keys(process.env)) {
    if (k.endsWith('_API_KEY')) delete process.env[k]
  }

  const admin = createAdminClient()
  const email = `d-${Date.now()}@verify.local`
  const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (!user.user) throw new Error('建立使用者失敗')
  const { spaceId } = await provisionSpaceForUser({ userId: user.user.id, email })

  try {
    const deps = await buildCompleteDeps(spaceId, '2026-07-24')

    let threw: unknown = null
    try {
      await completeForUsage('greeting', { spaceId, user: '早安' }, deps)
    } catch (e) {
      threw = e
    }

    if (threw instanceof QuotaExceededError) {
      throw new Error('預期不該是額度用盡（新 space 額度為 0）')
    }
    if (!(threw instanceof AllCandidatesFailedError)) {
      throw new Error(`預期 AllCandidatesFailedError（缺金鑰全跳過），實際：${String(threw)}`)
    }
    console.log('✓ 候選鏈查得到、預算閘門通過、缺金鑰全跳過 → 誠實拋 AllCandidatesFailedError')
    console.log('✓ buildCompleteDeps 正確接上真 Supabase（設金鑰後同路徑即可真呼叫）')

    // 確認沒有寫入假的 usage log（全跳過 → 沒成功呼叫 → 不該有 log）
    const { count } = await admin
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
    if ((count ?? 0) !== 0) throw new Error(`不該有 usage log，實際 ${count} 筆`)
    console.log('✓ 全跳過時不寫假的 usage log')

    console.log('\n✅ D 路由層整合驗證通過')
  } finally {
    await admin.from('spaces').delete().eq('id', spaceId)
    await admin.auth.admin.deleteUser(user.user.id)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
