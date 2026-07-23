import { createAdminClient } from '@snowrealm/db/server'

/**
 * Insight Engine（Milestone E）。docs/spec/07-agent.md、v1.0 §23.5。
 *
 * 本階段只產 **fact / metric**：純本地演算法，從使用者自己的活動算出來，
 * confidence 恆為 1.0，evidence.sourceIds 必填（可追溯到真實事件）。
 * inference / suggestion / creative 需要 LLM，留待 Milestone D。
 *
 * 文案是「數據描述」不是「空泛判斷」——說「這 7 天你換了 3 次主題」，
 * 不說「你很有美感」。走 service role（系統代算，寫入不開給一般成員）。
 */

export type Insight = {
  id: string
  type: string
  title: string
  statement: string
  evidence: { metric?: string; value?: number; sourceIds: string[] }
  confidence: number
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

type EventRow = { id: string; event_type: string; occurred_at: string }

function localDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 往前 n 天的當地日期（含今天共 n 天）。 */
function periodBounds(timeZone: string, days = 7): { start: string; end: string } {
  const end = localDate(timeZone)
  const past = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)
  return { start: localDate(timeZone, past), end }
}

const CANDIDATES: {
  type: string
  title: string
  metric: string
  /** 從事件清單算出 (值, 來源事件, 文案)；值為 0 時回 null（不產空洞的洞察）。 */
  compute: (events: EventRow[], tz: string) => { value: number; sourceIds: string[]; statement: string } | null
}[] = [
  {
    type: 'active_days',
    title: '出沒天數',
    metric: 'days',
    compute: (events, tz) => {
      const days = new Set(events.map((e) => localDate(tz, new Date(e.occurred_at))))
      if (days.size === 0) return null
      return {
        value: days.size,
        sourceIds: events.slice(0, 20).map((e) => e.id),
        statement: `過去 7 天，你有 ${days.size} 天打開了這個空間。`,
      }
    },
  },
  {
    type: 'theme_activity',
    title: '主題調整',
    metric: 'theme_events',
    compute: (events) => {
      const themed = events.filter((e) => e.event_type.startsWith('theme.'))
      if (themed.length === 0) return null
      return {
        value: themed.length,
        sourceIds: themed.map((e) => e.id),
        statement: `這 7 天你在外觀上動了 ${themed.length} 次（換主題、調色、套用）。`,
      }
    },
  },
  {
    type: 'upload_activity',
    title: '上傳',
    metric: 'uploads',
    compute: (events) => {
      const uploads = events.filter((e) => e.event_type === 'asset.uploaded')
      if (uploads.length === 0) return null
      return {
        value: uploads.length,
        sourceIds: uploads.map((e) => e.id),
        statement: `這 7 天你上傳了 ${uploads.length} 個檔案。`,
      }
    },
  },
  {
    type: 'activity_volume',
    title: '整體活動',
    metric: 'events',
    compute: (events) => {
      if (events.length < 3) return null // 太少不值得成一條洞察
      return {
        value: events.length,
        sourceIds: events.slice(0, 30).map((e) => e.id),
        statement: `這 7 天你在空間裡做了 ${events.length} 個動作。`,
      }
    },
  },
  {
    type: 'top_activity',
    title: '最常做的事',
    metric: 'top_count',
    compute: (events) => {
      if (events.length < 3) return null
      const counts = new Map<string, string[]>()
      for (const e of events) {
        const arr = counts.get(e.event_type) ?? []
        arr.push(e.id)
        counts.set(e.event_type, arr)
      }
      const top = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]
      if (!top) return null
      const label = EVENT_LABEL[top[0]] ?? top[0]
      return {
        value: top[1].length,
        sourceIds: top[1].slice(0, 20),
        statement: `這 7 天你最常做的是「${label}」，共 ${top[1].length} 次。`,
      }
    },
  },
]

const EVENT_LABEL: Record<string, string> = {
  'theme.applied': '套用主題',
  'theme.created': '建立主題',
  'theme.updated': '調整主題',
  'asset.uploaded': '上傳檔案',
  'background.added': '設定背景',
  'widget.added': '加入區塊',
  'layout.saved': '調整版面',
  'playlist.started': '播放背景',
  'settings.changed': '改設定',
}

/**
 * 產生本週期的 insight（冪等：unique(space,type,period)）。回傳目前這個週期的所有 insight。
 */
export async function generateInsights(spaceId: string, timeZone: string): Promise<Insight[]> {
  const admin = createAdminClient()
  const { start, end } = periodBounds(timeZone)

  // 週期起點的當地 00:00 → UTC 起點。用起點日字串當下界即可（多抓一點無妨）。
  const { data: events } = await admin
    .from('activity_events')
    .select('id, event_type, occurred_at')
    .eq('space_id', spaceId)
    .gte('occurred_at', `${start}T00:00:00`)
    .order('occurred_at', { ascending: false })

  const rows = (events ?? []) as EventRow[]

  const toUpsert = CANDIDATES.map((c) => {
    const r = c.compute(rows, timeZone)
    if (!r) return null
    return {
      space_id: spaceId,
      type: c.type,
      title: c.title,
      statement: r.statement,
      evidence: { metric: c.metric, value: r.value, sourceIds: r.sourceIds },
      confidence: 1, // metric 恆為 1.0
      period_start: start,
      period_end: end,
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  if (toUpsert.length > 0) {
    const { error } = await admin
      .from('insights')
      .upsert(toUpsert as never, { onConflict: 'space_id,type,period_start,period_end' })
    if (error) console.error('[insights] upsert 失敗', error.message)
  }

  return listInsights(spaceId, start, end)
}

/** 讀某週期的 insight（預設本週期）。 */
export async function listInsights(
  spaceId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<Insight[]> {
  const admin = createAdminClient()
  let q = admin
    .from('insights')
    .select('id, type, title, statement, evidence, confidence, period_start, period_end, created_at')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (periodStart) q = q.eq('period_start', periodStart)
  if (periodEnd) q = q.eq('period_end', periodEnd)

  const { data, error } = await q
  if (error) console.error('[insights] 讀取失敗', error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    statement: r.statement,
    evidence: (r.evidence as Insight['evidence']) ?? { sourceIds: [] },
    confidence: Number(r.confidence),
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
  }))
}

/** 軟刪除一則 insight（限本 space）。 */
export async function deleteInsight(spaceId: string, id: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('insights')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('space_id', spaceId)
    .eq('id', id)
  if (error) throw new Error(`刪除 insight 失敗：${error.message}`)
}
