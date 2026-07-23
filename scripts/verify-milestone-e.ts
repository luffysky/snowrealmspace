/** 驗證 E 的新引擎 API↔DB 對接（打 local DB，跑完清理）。 */
import { config } from 'dotenv'
config({ path: '.env.local' })
const { createAdminClient } = await import('@snowrealm/db/server')
const { generateInsights, listInsights, deleteInsight } = await import('../apps/web/lib/insights/engine.ts')
const { maybeGenerateProactive } = await import('../apps/web/lib/daily/proactive.ts')
const { createNotification, listNotifications, unreadCount, markRead, markAllRead } = await import('../apps/web/lib/notifications/store.ts')

const admin = createAdminClient()
const ok = (s: string) => console.log(`✓ ${s}`)
const bad = (s: string, e?: unknown) => { console.error(`✗ ${s}`, e); process.exitCode = 1 }

// 找一個現有 space + 一個 member user
const { data: sp } = await admin.from('spaces').select('id, timezone, owner_id').limit(1).maybeSingle()
if (!sp) { console.log('本地沒有 space，略過'); process.exit(0) }
const spaceId = sp.id as string
const tz = (sp.timezone as string) ?? 'Asia/Taipei'
const userId = sp.owner_id as string
console.log(`space=${spaceId} tz=${tz}`)

// 1. Insights
try {
  const ins = await generateInsights(spaceId, tz)
  ok(`generateInsights → ${ins.length} 筆（欄位對接正常）`)
  const listed = await listInsights(spaceId)
  ok(`listInsights → ${listed.length} 筆`)
  if (listed[0]) { await deleteInsight(spaceId, listed[0].id); ok('deleteInsight 正常') }
} catch (e) { bad('insights 引擎', e) }

// 2. Proactive（可能因 quiet hours / cap / mode 回 null，不算錯）
try {
  const msg = await maybeGenerateProactive(spaceId, userId, tz)
  ok(`maybeGenerateProactive → ${msg ? '產生一則' : '未產生（cap/quiet/mode，正常）'}`)
} catch (e) { bad('proactive 引擎', e) }

// 3. Notifications
try {
  await createNotification({ spaceId, userId, category: 'daily', title: '驗證通知', body: '測試', link: '/home' })
  ok('createNotification 正常')
  const list = await listNotifications(userId)
  ok(`listNotifications → ${list.length} 筆`)
  const u = await unreadCount(userId)
  ok(`unreadCount → ${u}`)
  const mine = list.find((n) => n.title === '驗證通知')
  if (mine) { await markRead(userId, mine.id); ok('markRead 正常') }
  await markAllRead(userId); ok('markAllRead 正常')
  // 清掉驗證通知
  await admin.from('notifications').delete().eq('user_id', userId).eq('title', '驗證通知')
} catch (e) { bad('notifications store', e) }

process.exit(process.exitCode ?? 0)
