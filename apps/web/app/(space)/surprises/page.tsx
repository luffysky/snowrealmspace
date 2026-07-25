import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import {
  listOpenedSurprises,
  rareDrought,
  DAILY_WEIGHTS,
  PITY_THRESHOLD,
} from '@snowrealm/daily-engine'
import { SurpriseArchive } from './SurpriseArchive'
import { EnvelopeCard } from '@/components/EnvelopeCard'
import { birthdayCardFor } from '@/lib/birthday-cards'

export const metadata: Metadata = { title: '驚喜收藏 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function SurprisesPage() {
  const { space, settings } = await requireActiveSpace()
  const [items, drought] = await Promise.all([
    listOpenedSurprises(space.id),
    rareDrought(space.id),
  ])

  // 生日卡常駐：填了生日就永遠能重看、保存（不只生日當天）。
  const hasBirthday = settings.birthday_month != null && settings.birthday_day != null

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

      {hasBirthday && (
        <section className="sr-stack">
          <h2 className="sr-section-title">你的生日卡 🎂</h2>
          <p className="sr-muted" style={{ margin: 0 }}>
            這張卡一直在這裡，想它的時候隨時再打開一次，也可以保存成圖片留著。
          </p>
          <EnvelopeCard {...birthdayCardFor(space.id)} savable />
        </section>
      )}

      <SurpriseArchive
        items={items}
        odds={odds}
        pityThreshold={PITY_THRESHOLD}
        drought={drought}
      />
    </div>
  )
}
