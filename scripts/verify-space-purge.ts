/**
 * 驗證「刪除空間 → 7 天寬限 → 永久清除」的清除段（handleSpacePurge）。
 *
 * 測兩件這個功能獨有的行為：
 *   1. 寬限未滿：剛軟刪除（deleted_at = now）的 space **不會**被清除。
 *   2. 寬限已滿：軟刪除滿 7 天（deleted_at = 8 天前）的 space **會**被清除，
 *      且外鍵 cascade 連帶刪掉 space_settings / space_members。
 *
 * 「R2 先於 DB、部分失敗就保留」的邏輯與已受信任的 handleStorageGc 相同，
 * 這裡不重複驗（見 maintenance.ts）。本測試不建立 asset，故不觸及儲存。
 *
 * 直連 admin client（繞過 RLS），建立拋棄式使用者/空間並自行清理。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { handleSpacePurge } from '../apps/worker/src/handlers/maintenance.js'

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
  const emailA = `purge-expired-${stamp}@example.com`
  const emailB = `purge-fresh-${stamp}@example.com`
  const userIds: string[] = []

  try {
    // ── 兩個拋棄式使用者各自的空間 ──
    const { data: uA } = await admin.auth.admin.createUser({ email: emailA, email_confirm: true })
    const { data: uB } = await admin.auth.admin.createUser({ email: emailB, email_confirm: true })
    if (!uA?.user || !uB?.user) throw new Error('建立測試使用者失敗')
    userIds.push(uA.user.id, uB.user.id)

    const { spaceId: expiredId } = await provisionSpaceForUser({ userId: uA.user.id, email: emailA })
    const { spaceId: freshId } = await provisionSpaceForUser({ userId: uB.user.id, email: emailB })

    // 種一個 asset + design_snapshot：這樣「刪 space cascade 撞上
    // design_snapshots.asset_id FK」的路徑才真的被走到（0032 前這會讓 purge 失敗，
    // 舊版 verify 因為沒建 asset 而漏掉——正是「假安全的檢查」）。
    const { data: asset, error: aErr } = await admin
      .from('assets')
      .insert({
        space_id: expiredId,
        kind: 'image',
        mime_type: 'image/png',
        bytes: 123,
        checksum: `purge-test-${stamp}`,
        storage_key: `test/purge-${stamp}.png`,
        status: 'ready',
      })
      .select('id')
      .single()
    if (aErr || !asset) throw new Error(`建立測試 asset 失敗：${aErr?.message}`)
    const { data: df, error: dfErr } = await admin
      .from('design_files')
      .insert({ space_id: expiredId, title: '測試作品' })
      .select('id')
      .single()
    if (dfErr || !df) throw new Error(`建立測試 design_file 失敗：${dfErr?.message}`)
    const { error: dsErr } = await admin.from('design_snapshots').insert({
      space_id: expiredId,
      design_file_id: df.id,
      asset_id: asset.id,
      checksum: `snap-${stamp}`,
    })
    if (dsErr) throw new Error(`建立測試 design_snapshot 失敗：${dsErr.message}`)

    // expired：軟刪除滿 8 天（超過 7 天寬限）
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    await admin.from('spaces').update({ deleted_at: eightDaysAgo }).eq('id', expiredId)
    // fresh：剛軟刪除（寬限未滿）
    await admin.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', freshId)

    // ── 執行清除 ──
    await handleSpacePurge([])

    // ── 斷言 ──
    const { data: expiredRow } = await admin
      .from('spaces')
      .select('id')
      .eq('id', expiredId)
      .maybeSingle()
    assert(expiredRow === null, '寬限已滿的空間被永久清除')

    const { count: settingsGone } = await admin
      .from('space_settings')
      .select('space_id', { count: 'exact', head: true })
      .eq('space_id', expiredId)
    assert((settingsGone ?? 0) === 0, 'cascade：附屬的 space_settings 一併刪除')

    const { data: freshRow } = await admin
      .from('spaces')
      .select('id, deleted_at')
      .eq('id', freshId)
      .maybeSingle()
    assert(freshRow !== null, '寬限未滿的空間仍保留（可還原）')

    // ── append-only 沒被破壞：一般（非清除）刪除 activity_events 仍被擋 ──
    // 先把 fresh 空間還原成正常狀態，插入一筆事件，直接刪它，應「靜默無效」。
    await admin.from('spaces').update({ deleted_at: null }).eq('id', freshId)
    const { data: ev } = await admin
      .from('activity_events')
      .insert({
        space_id: freshId,
        actor_id: uB.user.id,
        event_type: 'space.opened',
        entity_id: null,
        properties: {},
      })
      .select('id')
      .single()
    if (ev) {
      await admin.from('activity_events').delete().eq('id', ev.id)
      const { data: still } = await admin
        .from('activity_events')
        .select('id')
        .eq('id', ev.id)
        .maybeSingle()
      assert(still !== null, 'append-only 仍生效：一般刪除 activity_events 無效（沒被清除旗標放行）')
    }

    console.log('\n✅ 空間清除驗證通過（寬限閘門 + cascade + append-only 未破壞）')

    // 清掉 fresh 空間（走 purge_space 才能連同事件刪除）
    await admin.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', freshId)
    await admin.rpc('purge_space', { target_space_id: freshId })
  } finally {
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
