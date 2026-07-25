import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { generateInsights, type Insight } from '@snowrealm/daily-engine'

export const metadata: Metadata = { title: '每週回顧 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

import { InsightList } from './InsightList'

export default async function InsightsPage() {
  const { space } = await requireActiveSpace()
  // 進頁時就地生成本週期（冪等）—— 跟每日卡片一樣「開啟時若沒有就產」。
  const computed = await generateInsights(space.id, space.timezone)

  // 併入已存的 AI 洞察（suggestion/inference/creative）——AI 深入回顧產生的放前面
  const db = await getDb()
  const { data: stored } = await db
    .from('insights')
    .select('id, type, title, statement, evidence, confidence, period_start, period_end, created_at')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .in('type', ['suggestion', 'inference', 'creative'])
    .order('created_at', { ascending: false })
    .limit(20)
  const aiInsights: Insight[] = (stored ?? []).map((r) => ({
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
  const insights = [...aiInsights, ...computed]

  const period = insights[0]
  const range =
    period?.periodStart && period?.periodEnd
      ? `${period.periodStart} ～ ${period.periodEnd}`
      : '過去 7 天'

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>每週回顧</h1>
        <p className="sr-muted">
          根據你這 7 天在空間裡的實際活動整理。都是可查證的數據，不是空泛的評語。
          <br />
          <span style={{ fontSize: 'var(--sr-text-sm)' }}>{range}</span>
          <span style={{ margin: '0 var(--sr-space-2)' }}>·</span>
          <Link href="/home">回 Home</Link>
        </p>
      </section>

      <InsightList initial={insights} spaceId={space.id} />
    </div>
  )
}
