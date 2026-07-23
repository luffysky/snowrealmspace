import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import {
  listOpenedSurprises,
  rareDrought,
  DAILY_WEIGHTS,
  PITY_THRESHOLD,
} from '@/lib/daily/surprise'
import { SurpriseArchive } from './SurpriseArchive'

export const metadata: Metadata = { title: '驚喜收藏 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function SurprisesPage() {
  const { space } = await requireActiveSpace()
  const [items, drought] = await Promise.all([
    listOpenedSurprises(space.id),
    rareDrought(space.id),
  ])

  const total = Object.values(DAILY_WEIGHTS).reduce((a, b) => a + b, 0)
  const odds = Object.entries(DAILY_WEIGHTS).map(([rarity, w]) => ({
    rarity,
    percent: Math.round((w / total) * 100),
  }))

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>驚喜收藏</h1>
        <p className="sr-muted">
          每天打開的驚喜都收在這。<Link href="/home">← 回 Home</Link>
        </p>
      </section>

      <SurpriseArchive
        items={items}
        odds={odds}
        pityThreshold={PITY_THRESHOLD}
        drought={drought}
      />
    </div>
  )
}
