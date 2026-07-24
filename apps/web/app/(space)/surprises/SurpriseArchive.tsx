'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { rarityLabel, type ArchivedSurprise } from '@/lib/daily/surprise'
import { toggleSurpriseFavorite } from './actions'

type Odds = { rarity: string; percent: number }[]

/** 收藏頁：開過的驚喜牆 + 機率公開 + 保底進度。 */
export function SurpriseArchive({
  items,
  odds,
  pityThreshold,
  drought,
}: {
  items: ArchivedSurprise[]
  odds: Odds
  pityThreshold: number
  drought: number
}) {
  const [onlyFav, setOnlyFav] = useState(false)
  const shown = onlyFav ? items.filter((i) => i.favorited) : items
  const favCount = items.filter((i) => i.favorited).length

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-6)' }}>
      {/* 機率公開 —— 不藏數字（誠實） */}
      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginTop: 0 }}>掉落機率</h2>
        <div className="sr-odds-row">
          {odds.map((o) => (
            <div key={o.rarity} className="sr-odds-item" data-rarity={o.rarity}>
              <span className="sr-odds-dot" />
              <span className="sr-odds-name">{rarityLabel(o.rarity)}</span>
              <span className="sr-odds-pct">{o.percent}%</span>
            </div>
          ))}
        </div>
        <p className="sr-muted" style={{ marginBottom: 0 }}>
          保底：連續 {pityThreshold} 盒沒開到「稀有」以上，下一盒就保證是稀有。
          目前已連續 <strong>{drought}</strong> / {pityThreshold} 盒。
          {drought >= pityThreshold - 3 && drought < pityThreshold && '\u3000快保底了！'}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="sr-card sr-empty">
          <p className="sr-muted" style={{ margin: 0 }}>
            還沒開過任何驚喜。回 <Link href="/home">Home</Link> 打開今天的盒子吧。
          </p>
        </section>
      ) : (
        <>
          <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="sr-muted" style={{ margin: 0 }}>
              收集了 {items.length} 則{favCount > 0 ? `\u3000·\u3000★ ${favCount} 則收藏` : ''}
            </p>
            {favCount > 0 && (
              <button
                type="button"
                className={`sr-button ${onlyFav ? '' : 'sr-button-secondary'}`}
                aria-pressed={onlyFav}
                onClick={() => setOnlyFav((v) => !v)}
              >
                {onlyFav ? '顯示全部' : '只看收藏'}
              </button>
            )}
          </div>

          <div className="sr-archive-grid">
            {shown.map((item) => (
              <ArchiveCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ArchiveCard({ item }: { item: ArchivedSurprise }) {
  const [fav, setFav] = useState(item.favorited)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !fav
    setFav(next) // 樂觀更新
    startTransition(async () => {
      const res = await toggleSurpriseFavorite({ id: item.id, favorited: next })
      if (!res.ok) setFav(!next) // 失敗回滾
    })
  }

  const date = new Date(item.openedAt).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <article className="sr-archive-card" data-rarity={item.rarity}>
      <header className="sr-archive-card-head">
        <span className="sr-surprise-rarity" data-rarity={item.rarity}>
          {rarityLabel(item.rarity)}
        </span>
        <button
          type="button"
          className="sr-fav-star"
          aria-pressed={fav}
          aria-label={fav ? '取消收藏' : '收藏'}
          onClick={toggle}
          disabled={pending}
        >
          {fav ? '★' : '☆'}
        </button>
      </header>
      <h3 className="sr-archive-card-title">{item.label}</h3>
      {item.text && <p className="sr-archive-card-text">{item.text}</p>}
      <time className="sr-muted sr-archive-card-date">{date}</time>
    </article>
  )
}
