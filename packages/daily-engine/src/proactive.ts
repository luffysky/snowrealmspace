import { createAdminClient } from '@snowrealm/db/server'
import { passesContentFilter, hashToUnit } from '@snowrealm/validation'

/**
 * 主動訊息（Milestone E）。docs/spec/10-acceptance.md：觸發條件、頻率上限 3/日、Quiet hours。
 *
 * 本階段**不用 LLM**：內容來自內容池（prompt/quote）與里程碑模板，
 * 全部先過 FORBIDDEN_PATTERNS（被攔的不寫入、不佔額度）。Milestone D 有 Agent 後再升級。
 *
 * 產出以 notification（category='agent' 或 'milestone'）呈現。走 service role。
 */

const DAILY_CAP = 3

function localParts(timeZone: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  return { date, minutes }
}

/** now 是否落在 quiet hours 內（支援跨午夜，如 22:00–07:00）。 */
function inQuietHours(nowMin: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false
  const toMin = (t: string) => {
    const [h, m] = t.split(':')
    return Number(h) * 60 + Number(m ?? 0)
  }
  const s = toMin(start)
  const e = toMin(end)
  if (s === e) return false
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e
}

type Settings = {
  agent_proactive: string
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

/**
 * 若條件允許，產生今天的一則主動訊息。回傳訊息文字（已寫入通知）或 null（沒產）。
 */
export async function maybeGenerateProactive(
  spaceId: string,
  userId: string,
  timeZone: string,
): Promise<string | null> {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('space_settings')
    .select('agent_proactive, quiet_hours_start, quiet_hours_end')
    .eq('space_id', spaceId)
    .maybeSingle<Settings>()

  const mode = settings?.agent_proactive ?? 'important_only'
  if (mode === 'off') return null

  const { date, minutes } = localParts(timeZone)
  if (inQuietHours(minutes, settings?.quiet_hours_start ?? null, settings?.quiet_hours_end ?? null)) {
    return null
  }

  // 頻率上限 3/日（agent + milestone 一起算）
  const { count: todayCount } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .in('category', ['agent', 'milestone'])
    .gte('created_at', `${date}T00:00:00`)
  if ((todayCount ?? 0) >= DAILY_CAP) return null

  // 1) 里程碑（未送過才送）—— important_only 只送這類
  const milestone = await nextMilestone(admin, spaceId, userId)
  if (milestone) {
    await admin.from('notifications').insert({
      space_id: spaceId,
      user_id: userId,
      category: 'milestone',
      title: milestone.title,
      body: milestone.body,
      link: '/home',
      payload: { key: milestone.key },
      channel: 'in_app',
    } as never)
    return milestone.body
  }

  if (mode === 'important_only') return null

  // 2) 每日陪伴訊息（daily/adaptive/custom）—— 一天一則
  const { count: agentToday } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('category', 'agent')
    .gte('created_at', `${date}T00:00:00`)
  if ((agentToday ?? 0) >= 1) return null

  const text = await pickCompanionLine(admin, spaceId, date)
  if (!text) return null

  await admin.from('notifications').insert({
    space_id: spaceId,
    user_id: userId,
    category: 'agent',
    title: '今天想跟你說',
    body: text,
    link: '/home',
    channel: 'in_app',
  } as never)
  return text
}

type Admin = ReturnType<typeof createAdminClient>

/** 從內容池挑一句陪伴訊息（決定性、過安全過濾）。 */
async function pickCompanionLine(admin: Admin, spaceId: string, date: string): Promise<string | null> {
  const { data } = await admin
    .from('content_items')
    .select('content_id, text')
    .in('kind', ['prompt', 'quote'])
    .eq('enabled', true)
    .limit(500)
  const pool = (data ?? []).filter((r) => passesContentFilter(r.text))
  if (pool.length === 0) return null
  const seed = hashToUnit(`${spaceId}:proactive:${date}`)
  const row = pool[Math.floor(seed * pool.length) % pool.length]!
  return row.text
}

/** 下一個尚未通知過的里程碑。 */
async function nextMilestone(
  admin: Admin,
  spaceId: string,
  _userId: string,
): Promise<{ key: string; title: string; body: string } | null> {
  // 已送過的里程碑 key
  const { data: sent } = await admin
    .from('notifications')
    .select('payload')
    .eq('space_id', spaceId)
    .eq('category', 'milestone')
  const sentKeys = new Set(
    (sent ?? []).map((r) => (r.payload as { key?: string })?.key).filter(Boolean) as string[],
  )

  const [themes, assets] = await Promise.all([
    admin.from('themes').select('id', { count: 'exact', head: true }).eq('space_id', spaceId).is('deleted_at', null),
    admin
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
      .is('deleted_at', null)
      .eq('status', 'ready'),
  ])

  const candidates: { key: string; met: boolean; title: string; body: string }[] = [
    {
      key: 'first_theme',
      met: (themes.count ?? 0) >= 1,
      title: '第一套主題',
      body: '你做出了第一套自己的主題 —— 這個空間開始有你的樣子了。',
    },
    {
      key: 'first_upload',
      met: (assets.count ?? 0) >= 1,
      title: '第一個上傳',
      body: '你放進了第一個檔案。慢慢地，這裡會裝滿你在乎的東西。',
    },
  ]

  for (const c of candidates) {
    if (c.met && !sentKeys.has(c.key)) return { key: c.key, title: c.title, body: c.body }
  }
  return null
}
