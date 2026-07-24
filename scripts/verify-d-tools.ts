/**
 * D Tool 執行流程驗證（直連 DB，不需金鑰）：
 *  - 不需確認的 tool 立即執行、建 executed 的 agent_action
 *  - 需確認的 tool（apply_theme / tag_asset≥3）先 pending，confirm 後才執行
 *  - undo 24h 內復原
 *  - save_memory_proposal 建的是 pending 記憶（ADR-014 不得直接 approved）
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { executeToolCall, confirmAction, undoAction } from '../apps/web/lib/agent/tools.js'

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
  const email = `dtools-${Date.now()}@verify.local`
  const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (!user.user) throw new Error('建立使用者失敗')
  const { spaceId } = await provisionSpaceForUser({ userId: user.user.id, email })
  // ctx.db 在 tools.ts 中未使用（handler 都用 admin），傳 admin 即可
  const ctx = { db: admin, userId: user.user.id, spaceId, role: 'owner' as const }

  try {
    // 1. create_project（不需確認）→ 立即執行
    const r1 = await executeToolCall(ctx, 'create_project', { name: 'Agent 建的專案', status: 'active' })
    assert(r1.status === 'executed', 'create_project 立即執行（不需確認）')
    const { count: projCount } = await admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
      .eq('name', 'Agent 建的專案')
    assert((projCount ?? 0) === 1, 'create_project 真的建立了專案')

    // 2. save_memory_proposal → pending 記憶（approved=false）
    const r2 = await executeToolCall(ctx, 'save_memory_proposal', { content: '偏好暖色', type: 'preference' })
    assert(r2.status === 'executed', 'save_memory_proposal 執行')
    const { data: mem } = await admin
      .from('memories')
      .select('approved, source_type')
      .eq('space_id', spaceId)
      .eq('content', '偏好暖色')
      .maybeSingle()
    assert(mem?.approved === false && mem?.source_type === 'agent_summary', '記憶提案 approved=false（ADR-014）')

    // 3. apply_theme（需確認）—— 先建一個 theme
    const { data: theme } = await admin
      .from('themes')
      .insert({ space_id: spaceId, name: 'T', definition: {} as never, source: 'manual' })
      .select('id')
      .single()
    const r3 = await executeToolCall(ctx, 'apply_theme', { themeId: theme!.id })
    assert(r3.status === 'pending_confirmation', 'apply_theme 需要確認（pending）')
    const actionId = r3.status === 'pending_confirmation' ? r3.actionId : ''
    const r3b = await confirmAction(ctx, actionId)
    assert(r3b.status === 'executed', 'confirm 後 apply_theme 執行')
    const { data: sp } = await admin.from('spaces').select('active_theme_id').eq('id', spaceId).maybeSingle()
    assert(sp?.active_theme_id === theme!.id, '主題真的套用到 space')

    // 4. undo apply_theme → 復原
    const r4 = await undoAction(ctx, actionId)
    assert(r4.status === 'executed', 'undo apply_theme 成功')
    const { data: sp2 } = await admin.from('spaces').select('active_theme_id').eq('id', spaceId).maybeSingle()
    assert(sp2?.active_theme_id === null, 'undo 後主題還原（回 null）')

    // 5. tag_asset 3 個 → 需確認
    const assetIds: string[] = []
    for (let i = 0; i < 3; i++) {
      const { data: a } = await admin
        .from('assets')
        .insert({
          space_id: spaceId,
          kind: 'image',
          mime_type: 'image/png',
          bytes: 10,
          checksum: `t${i}-${Date.now()}`,
          storage_key: `t/${i}-${Date.now()}.png`,
          status: 'ready',
        })
        .select('id')
        .single()
      assetIds.push(a!.id)
    }
    const r5 = await executeToolCall(ctx, 'tag_asset', { assetIds, tags: ['海報'], mode: 'add' })
    assert(r5.status === 'pending_confirmation', 'tag_asset 3 個 → 需確認（§4.3）')

    console.log('\n✅ D Tool 執行流程驗證通過')
  } finally {
    await admin.from('spaces').delete().eq('id', spaceId)
    await admin.auth.admin.deleteUser(user.user.id)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
