import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@snowrealm/db/server'
import { hashIp } from '@snowrealm/analytics'
import { resolveUser } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { parseDevice } from '@/lib/analytics/device'
import { lookupGeo } from '@/lib/analytics/geo'

/**
 * 使用者上線心跳。前端每 60 秒（與切回分頁時）POST 一次，供後台顯示
 * 「上線時間 / 在線時長 / 最後上線 / 地區 / 裝置」。
 *
 * 隱私：**原始 IP 絕不落地**——只存 ip_hash（salted SHA-256）與地區字串。
 * 寫入一律走 service role（站台級分析，同 activity_events；規則 #10）。
 * 讀取由 user_sessions 的 RLS（site-admin only）+ checkSiteAdmin 把關。
 *
 * Node runtime：geo 用到 fetch 外呼、hashIp 用到 node:crypto。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1).max(2048),
})

// 單次心跳最多累計的秒數。超過（例如分頁擱置整晚才回來）就 clamp，
// 避免一個放著不動的分頁灌爆在線時長。
const MAX_BEAT_SEC = 300

function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip')
}

export const POST = handler(async (request: NextRequest) => {
  // 必須登入（匿名不記）。用 resolveUser：不需要 space。
  const auth = await resolveUser()
  if (!auth) return fail('UNAUTHENTICATED', '請先登入。')

  const raw: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return failValidation(parsed.error)
  const { sessionId, path } = parsed.data

  const admin = createAdminClient()
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  // 先讀現況，決定「首次插入」或「更新」。心跳間隔 60s，同 session 幾乎不會並發，
  // 這裡的 read-then-write 對競態足夠寬容且便宜。
  const { data: existing } = await admin
    .from('user_sessions')
    .select('id, current_path, page_count, total_duration_sec, last_seen_at')
    .eq('id', sessionId)
    .maybeSingle()

  if (!existing) {
    // ── 首次插入：只有這時做 geo / device 查詢（避免每次心跳都外呼）──
    const ua = request.headers.get('user-agent')
    const device = parseDevice(ua)
    const geo = await lookupGeo(request.headers, clientIp(request.headers))

    const { error } = await admin.from('user_sessions').insert({
      id: sessionId,
      user_id: auth.userId,
      started_at: nowIso,
      last_seen_at: nowIso,
      current_path: path,
      page_count: 1,
      total_duration_sec: 0,
      ip_hash: hashIp(clientIp(request.headers)),
      country: geo.country ?? null,
      region: geo.region ?? null,
      city: geo.city ?? null,
      device_type: device.deviceType,
      browser: device.browser,
      os: device.os,
    })
    if (error) {
      // 唯一鍵競態（同 session 幾乎同時第一次插入）→ 當作已存在，忽略
      if (error.code === '23505') return ok({ ok: true })
      console.warn('[heartbeat] insert 失敗:', error.message)
      return ok({ ok: false })
    }
    return ok({ ok: true })
  }

  // ── 更新：累加時長（clamp [0, 300]）、路徑變了才 +1 頁數 ──
  const prevSeen = existing.last_seen_at ? new Date(existing.last_seen_at).getTime() : nowMs
  const elapsedSec = Math.max(0, Math.min(MAX_BEAT_SEC, Math.round((nowMs - prevSeen) / 1000)))
  const pathChanged = existing.current_path !== path

  const { error } = await admin
    .from('user_sessions')
    .update({
      last_seen_at: nowIso,
      current_path: path,
      page_count: (existing.page_count ?? 0) + (pathChanged ? 1 : 0),
      total_duration_sec: (existing.total_duration_sec ?? 0) + elapsedSec,
      updated_at: nowIso,
    })
    .eq('id', sessionId)
  if (error) {
    console.warn('[heartbeat] update 失敗:', error.message)
    return ok({ ok: false })
  }
  return ok({ ok: true })
})
