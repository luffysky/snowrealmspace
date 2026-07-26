import { completeForUsage } from '@snowrealm/ai-core'
import type { createAdminClient } from '@snowrealm/db/server'

/**
 * 長對話滾動摘要。
 *
 * 對話只送「最近 N 則」給模型（見 chat route 的 HISTORY_LIMIT）。更舊的內容若直接丟掉，
 * 模型就會忘記前面聊過什麼。這裡把「視窗之外的較舊訊息」濃縮進 agent_threads.summary，
 * 下一輪再把摘要塞回 system prompt —— 長對話也記得脈絡，又不必每次送整串訊息。
 *
 * 設計取捨：
 *   - 只在訊息數超過門檻、且落在批次邊界時重算（不是每輪都算），控制成本。
 *   - 用免費模型（conversation_summary 候選鏈）；失敗不影響對話，保留舊摘要下次再試。
 *   - 走 service role（agent_messages/threads 對成員唯讀）。
 */

const RECENT_WINDOW = 12 // 與 chat route 的 HISTORY_LIMIT 對齊：這些仍完整送給模型
const SUMMARY_TRIGGER = 18 // 訊息數超過這個才開始摘要（視窗已裝不下）
const SUMMARY_INTERVAL = 6 // 每隔這麼多則重算一次，避免每輪都摘要
const OLDER_CAP = 40 // 餵給摘要器的較舊訊息上限；更舊的已反映在既有摘要裡

type Admin = ReturnType<typeof createAdminClient>
type Deps = Parameters<typeof completeForUsage>[2]

export async function summarizeThreadIfNeeded(
  admin: Admin,
  deps: Deps,
  spaceId: string,
  threadId: string,
): Promise<void> {
  const { count } = await admin
    .from('agent_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
  const total = count ?? 0

  if (total < SUMMARY_TRIGGER) return
  // 只在批次邊界重算（total 每輪 +2，這讓摘要大約每 3 次往返跑一次）
  if ((total - SUMMARY_TRIGGER) % SUMMARY_INTERVAL !== 0) return

  const olderCount = total - RECENT_WINDOW
  if (olderCount <= 0) return

  const { data: thread } = await admin
    .from('agent_threads')
    .select('summary')
    .eq('id', threadId)
    .maybeSingle<{ summary: string | null }>()
  const prior = thread?.summary ?? ''

  const { data: older } = await admin
    .from('agent_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(Math.min(olderCount, OLDER_CAP))

  const transcript = (older ?? [])
    .map((m) => `${m.role === 'user' ? '使用者' : '助理'}：${(m.content ?? '').slice(0, 500)}`)
    .join('\n')
  if (!transcript.trim()) return

  const system =
    '你是對話摘要器。把對話濃縮成不超過 150 字的繁體中文摘要，抓住重點事實、決定、使用者偏好與尚未完成的話題。' +
    '只輸出摘要本身，不要客套或前後綴。'
  const user = prior
    ? `目前摘要：\n${prior}\n\n以下是較早的對話內容，請據此更新摘要（合併、去重）：\n${transcript}`
    : `以下是較早的對話內容，請摘要：\n${transcript}`

  try {
    const completion = await completeForUsage(
      'conversation_summary',
      { spaceId, system, user: [{ role: 'user', content: user }] },
      deps,
    )
    const summary = completion.text?.trim()
    if (summary) {
      await admin.from('agent_threads').update({ summary } as never).eq('id', threadId)
    }
  } catch {
    // 摘要失敗不影響對話：保留舊摘要，下次批次邊界再試。
  }
}
