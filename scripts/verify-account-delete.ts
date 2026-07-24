/**
 * 驗證刪除帳號的關鍵路徑（直連 admin）：
 *   1. 先永久清除本人名下 space（purge_space），刪 auth 使用者才不會被 activity_events
 *      的 append-only 規則擋住 cascade。
 *   2. 使用者在**別人** space 留下的事件，刪帳號時 FK 的 ON DELETE SET NULL 會把 actor_id
 *      設成 NULL（匿名化）——0031 讓 content_guard 放行這個 NULL、但仍禁止改成別的使用者。
 *
 * 不建立 asset，故不觸及儲存（R2 先於 DB 的部分見 verify-space-purge）。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'

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
  const stamp = Date.now()
  const emailVictim = `acct-victim-${stamp}@example.com`
  const emailOther = `acct-other-${stamp}@example.com`
  const cleanup: string[] = []

  try {
    const { data: v } = await admin.auth.admin.createUser({ email: emailVictim, email_confirm: true })
    const { data: o } = await admin.auth.admin.createUser({ email: emailOther, email_confirm: true })
    if (!v?.user || !o?.user) throw new Error('建立測試使用者失敗')
    cleanup.push(o.user.id) // victim 會在測試中被刪

    const { spaceId: victimSpace } = await provisionSpaceForUser({ userId: v.user.id, email: emailVictim })
    const { spaceId: otherSpace } = await provisionSpaceForUser({ userId: o.user.id, email: emailOther })

    // victim 在「別人」的 space 留下一筆事件（模擬協作）
    const { data: ev } = await admin
      .from('activity_events')
      .insert({
        space_id: otherSpace,
        actor_id: v.user.id,
        event_type: 'space.opened',
        entity_id: null,
        properties: {},
      })
      .select('id')
      .single()
    if (!ev) throw new Error('插入跨 space 事件失敗')

    // ── 刪除帳號流程：先清名下 space，再刪 user ──
    await admin.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', victimSpace)
    const { error: purgeErr } = await admin.rpc('purge_space', { target_space_id: victimSpace })
    assert(!purgeErr, '名下 space 永久清除成功')

    const { error: delErr } = await admin.auth.admin.deleteUser(v.user.id)
    assert(!delErr, '刪除 auth 使用者成功（沒被 append-only / content_guard 擋住）')

    // 名下 space 不在了
    const { data: goneSpace } = await admin.from('spaces').select('id').eq('id', victimSpace).maybeSingle()
    assert(goneSpace === null, '名下 space 已消失')

    // 別人 space 的事件還在，但 actor 被匿名化成 NULL
    const { data: keptEvent } = await admin
      .from('activity_events')
      .select('id, actor_id')
      .eq('id', ev.id)
      .maybeSingle()
    assert(keptEvent !== null, '在別人 space 的事件保留（不刪別人的資料）')
    assert(keptEvent?.actor_id === null, 'actor 被匿名化為 NULL（content_guard 放行、FK SET NULL 生效）')

    console.log('\n✅ 刪除帳號驗證通過（清名下 space + 跨 space 事件匿名化）')

    // 清掉 other space + user
    await admin.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', otherSpace)
    await admin.rpc('purge_space', { target_space_id: otherSpace })
  } finally {
    for (const id of cleanup) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
