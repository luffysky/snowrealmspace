import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import { generateInsights } from '@/lib/insights/engine'

export const metadata: Metadata = { title: '每週回顧 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

import { InsightList } from './InsightList'

export default async function InsightsPage() {
  const { space } = await requireActiveSpace()
  // 進頁時就地生成本週期（冪等）—— 跟每日卡片一樣「開啟時若沒有就產」。
  const insights = await generateInsights(space.id, space.timezone)

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

      <InsightList initial={insights} />
    </div>
  )
}
