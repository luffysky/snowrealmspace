import { completeForUsage, clampStatement, AllCandidatesFailedError, QuotaExceededError } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import { buildCompleteDeps } from '@/lib/ai/deps'

export const dynamic = 'force-dynamic'

const SYSTEM = `你是溫柔、細心的觀察者。根據使用者這段時間的活動摘要，給 1–2 個「建議」型的觀察 ——
溫暖、具體、可行、不說教、不打分數。用繁體中文。
只根據摘要裡真的發生的事，不要編造沒提到的活動。
只輸出 JSON 陣列，每項 { "title": 簡短標題, "statement": 一兩句話的建議 }，不要多餘文字。`

/**
 * AI 深入回顧（suggestion 型）。從既有 fact/metric 回顧生成建議型洞察，clampStatement 後處理、存進 insights。
 * graceful：AI 不可用時回 added:0 與誠實訊息，不生成假結果，也不擋既有回顧。
 */
export const POST = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result

  // 既有 fact/metric 回顧當素材（RLS：只讀自己 space 的）
  const { data: base } = await ctx.db
    .from('insights')
    .select('type, title, statement')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .in('type', ['fact', 'metric'])
    .order('created_at', { ascending: false })
    .limit(12)

  if (!base || base.length < 2) {
    return ok({ added: 0, message: '活動還不夠多，先多用幾天再回來看看。' })
  }

  const summary = base.map((b) => `- ${b.title}：${b.statement}`).join('\n')
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)

  let text: string
  try {
    const completion = await completeForUsage(
      'weekly_recap',
      { spaceId: ctx.spaceId, system: SYSTEM, user: `這是最近的活動觀察：\n${summary}` },
      deps,
    )
    text = completion.text
  } catch (err) {
    if (err instanceof QuotaExceededError) return ok({ added: 0, message: '今日 AI 額度已用完，明天再試。' })
    if (err instanceof AllCandidatesFailedError) return ok({ added: 0, message: 'AI 暫時無法使用（可能金鑰或額度），既有回顧不受影響。' })
    console.error('[insights.generate]', (err as Error).message)
    return fail('INTERNAL', '生成時發生問題，請重試。')
  }

  // 取出 JSON 陣列（LLM 可能包 markdown）
  const match = text.match(/\[[\s\S]*\]/)
  let parsed: { title?: unknown; statement?: unknown }[] = []
  try {
    parsed = match ? (JSON.parse(match[0]) as typeof parsed) : []
  } catch {
    return ok({ added: 0, message: 'AI 這次沒給出可用的建議，稍後再試。' })
  }

  const admin = createAdminClient()
  const created: { title: string; statement: string; confidence: number }[] = []
  for (const item of parsed.slice(0, 2)) {
    const title = typeof item.title === 'string' ? item.title.slice(0, 120) : ''
    const body = typeof item.statement === 'string' ? item.statement.slice(0, 500) : ''
    if (!title || !body) continue
    // suggestion：可空證據、confidence < 1（clampStatement 保證）
    const clamped = clampStatement({ category: 'suggestion', text: body, evidence: { sourceIds: [] }, confidence: 0.6 })
    const confidence = clamped.confidence ?? 0.6
    const { error } = await admin.from('insights').insert({
      space_id: ctx.spaceId,
      type: 'suggestion',
      title,
      statement: body,
      evidence: { sourceIds: [] },
      confidence,
      visibility: 'private',
    })
    if (!error) created.push({ title, statement: body, confidence })
  }

  return ok({ added: created.length, insights: created })
})
