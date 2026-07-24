/**
 * C5 閉環驗證：event.project 投影 + 節流（直連 DB，不需 worker 常駐）。
 *
 * 1. 建測試 space
 * 2. 插入 activity_events：1× project.created、3× asset.uploaded（同時間窗，測節流）、
 *    1× space.opened（不投影）
 * 3. 直接呼叫 handleEventProject
 * 4. 斷言 timeline_events：project.created 1 筆 + asset.uploaded 合併成 1 筆（groupTitle）；
 *    space.opened 不投影；所有事件 projected_at 已標記
 * 5. 冪等：再跑一次不新增
 * 6. 清理
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { handleEventProject } from '../apps/worker/src/handlers/event-project.js'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exitCode = 1
    throw new Error(msg)
  }
  console.log(`✓ ${msg}`)
}

async function main() {
  const admin = createAdminClient()
  const email = `c5-${Date.now()}@verify.local`
  const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (!user.user) throw new Error('建立使用者失敗')
  const { spaceId } = await provisionSpaceForUser({ userId: user.user.id, email })

  try {
    const base = new Date('2026-07-24T10:00:00Z').getTime()
    const at = (min: number) => new Date(base + min * 60_000).toISOString()

    await admin.from('activity_events').insert([
      { space_id: spaceId, actor_id: user.user.id, event_type: 'project.created', properties: { name: '海報', projectId: null }, occurred_at: at(0) },
      { space_id: spaceId, actor_id: user.user.id, event_type: 'asset.uploaded', entity_id: null, properties: {}, occurred_at: at(1) },
      { space_id: spaceId, actor_id: user.user.id, event_type: 'asset.uploaded', entity_id: null, properties: {}, occurred_at: at(2) },
      { space_id: spaceId, actor_id: user.user.id, event_type: 'asset.uploaded', entity_id: null, properties: {}, occurred_at: at(3) },
      { space_id: spaceId, actor_id: user.user.id, event_type: 'space.opened', properties: { route: '/home' }, occurred_at: at(4) },
    ])

    await handleEventProject([])

    const { data: tl } = await admin
      .from('timeline_events')
      .select('event_type, title')
      .eq('space_id', spaceId)
      .order('occurred_at', { ascending: true })

    const events = tl ?? []
    assert(events.length === 2, `投影出 2 筆 timeline（實際 ${events.length}）`)
    assert(
      events.some((e) => e.event_type === 'project.created' && e.title === '開始了「海報」'),
      'project.created 投影標題正確',
    )
    assert(
      events.some((e) => e.event_type === 'asset.uploaded' && e.title === '新增了 3 個作品'),
      '3 筆 asset.uploaded 節流合併成 1 筆（groupTitle）',
    )
    assert(
      !events.some((e) => e.event_type === 'space.opened'),
      'space.opened 不投影',
    )

    const { count: unprojected } = await admin
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
      .is('projected_at', null)
    assert((unprojected ?? -1) === 0, '所有事件已標記 projected_at')

    // 冪等：再跑一次不新增
    await handleEventProject([])
    const { count: after } = await admin
      .from('timeline_events')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
    assert((after ?? -1) === 2, '冪等：重跑不新增（仍 2 筆）')

    console.log('\n✅ C5 投影閉環全數通過')
  } finally {
    await admin.from('spaces').delete().eq('id', spaceId)
    await admin.auth.admin.deleteUser(user.user.id)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
