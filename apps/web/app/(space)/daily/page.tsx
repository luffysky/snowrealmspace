import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '每日回顧 — SnowRealm-Space' }
export const dynamic = 'force-dynamic'

type Item = { local_date: string; kind: string; body: string; payload: unknown }

/**
 * 每日回顧：往回看每天出現過的語錄與創作提示（存在 daily_items）。
 * greeting 是依時段即時挑、不入庫，所以這裡不列（回顧的是「當天的內容」）。
 */
export default async function DailyReviewPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const { data } = await db
    .from('daily_items')
    .select('local_date, kind, body, payload')
    .eq('space_id', space.id)
    .in('kind', ['daily_card', 'creative_prompt'])
    .order('local_date', { ascending: false })
    .limit(400)

  const items = (data ?? []) as Item[]

  // 依日期分組（新到舊）
  const byDate = new Map<string, { quote?: string; prompt?: string; minutes?: number | null }>()
  for (const it of items) {
    const day = byDate.get(it.local_date) ?? {}
    if (it.kind === 'daily_card') day.quote = it.body
    if (it.kind === 'creative_prompt') {
      day.prompt = it.body
      day.minutes = (it.payload as { estimatedMinutes?: number } | null)?.estimatedMinutes ?? null
    }
    byDate.set(it.local_date, day)
  }
  const days = [...byDate.entries()]

  return (
    <main className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>每日回顧</h1>
        <p className="sr-muted">這些日子裡，這個空間陪你看過的句子與想過的題目。</p>
      </section>

      {days.length === 0 ? (
        <p className="sr-muted">還沒有累積任何每日內容。多回來幾天就會長出來。</p>
      ) : (
        <div className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
          {days.map(([date, d]) => (
            <section key={date} className="sr-card">
              <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginBottom: 'var(--sr-space-2)' }}>
                {date}
              </div>
              {d.quote && (
                <blockquote className="sr-daily-quote" style={{ margin: 0 }}>
                  {d.quote}
                </blockquote>
              )}
              {d.prompt && (
                <div className="sr-daily-prompt" style={{ marginTop: d.quote ? 'var(--sr-space-3)' : 0 }}>
                  <span className="sr-label" style={{ marginBottom: 4 }}>
                    那天的題目
                  </span>
                  <p style={{ margin: 0 }}>{d.prompt}</p>
                  {d.minutes != null && <span className="sr-muted sr-daily-minutes">約 {d.minutes} 分鐘</span>}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
