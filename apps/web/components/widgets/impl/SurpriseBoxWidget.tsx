'use client'

import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 驚喜盒。09-content-pool.md。
 *
 * 每天一個可開的盒子。開盒依稀有度機率抽一則沒開過的內容，
 * 由 /api/surprise 決定（客戶端不能自己選稀有度）。
 * 同一天內結果穩定，重整不會刷新。
 */

type Rarity = 'common' | 'uncommon' | 'rare' | 'special' | 'anniversary'
type View =
  | { state: 'available' }
  | { state: 'opened'; rarity: Rarity; label: string; text: string; openedAt: string }
  | { state: 'empty' }
  | { state: 'loading' }

const RARITY_LABEL: Record<Rarity, string> = {
  common: '平凡',
  uncommon: '少見',
  rare: '稀有',
  special: '特別',
  anniversary: '週年',
}

export default function SurpriseBoxWidget({ config }: WidgetProps) {
  const cfg = config as { showRarityLabel?: boolean; autoOpenOnLogin?: boolean } | null
  const showRarityLabel = cfg?.showRarityLabel ?? true
  const autoOpenOnLogin = cfg?.autoOpenOnLogin ?? false

  const [view, setView] = useState<View>({ state: 'loading' })
  const [opening, setOpening] = useState(false)
  const [justOpened, setJustOpened] = useState(false)
  // autoOpenOnLogin：每個 space 每天只自動開一次（存 localStorage，避免每次進頁都自動開）
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/surprise')
      if (cancelled) return
      if (!res.ok) return setView({ state: 'empty' })
      const body = (await res.json()) as { data: View }
      if (!cancelled) setView(body.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 開啟「登入自動打開」時：今天還沒開過就自動開一次
  useEffect(() => {
    if (!autoOpenOnLogin || autoOpenedRef.current) return
    if (view.state !== 'available') return
    const today = new Intl.DateTimeFormat('en-CA').format(new Date())
    const key = 'sr:surprise-autoopen'
    if (localStorage.getItem(key) === today) return
    autoOpenedRef.current = true
    localStorage.setItem(key, today)
    void open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenOnLogin, view.state])

  async function open() {
    setOpening(true)
    try {
      const res = await fetch('/api/surprise', { method: 'POST' })
      const body = (await res.json()) as { data?: View }
      if (res.ok && body.data) {
        setView(body.data)
        setJustOpened(true)
      }
    } finally {
      setOpening(false)
    }
  }

  if (view.state === 'loading') {
    return (
      <div className="sr-card sr-surprise" aria-busy="true">
        <span className="sr-muted">驚喜盒…</span>
      </div>
    )
  }

  if (view.state === 'empty') {
    return (
      <div className="sr-card sr-surprise">
        <p className="sr-muted" style={{ margin: 0 }}>
          今天沒有驚喜。
        </p>
      </div>
    )
  }

  if (view.state === 'available') {
    return (
      <div className="sr-card sr-surprise sr-surprise-closed">
        <div className="sr-surprise-box" aria-hidden="true">
          <span className="sr-surprise-lid" />
          <span className="sr-surprise-ribbon" />
          <span className="sr-surprise-shine" />
        </div>
        <p className="sr-surprise-tease">今天有一個為你留的東西。</p>
        <button
          type="button"
          className="sr-button sr-surprise-open"
          onClick={() => void open()}
          disabled={opening}
        >
          {opening ? '打開中…' : '打開'}
        </button>
      </div>
    )
  }

  // opened
  return (
    <div
      className={`sr-card sr-surprise sr-surprise-opened ${justOpened ? 'sr-surprise-reveal' : ''}`}
      data-rarity={view.rarity}
    >
      <div className="sr-surprise-glow" aria-hidden="true" />
      {showRarityLabel && (
        <span className="sr-surprise-rarity" data-rarity={view.rarity}>
          {RARITY_LABEL[view.rarity]}
        </span>
      )}
      <p className="sr-surprise-label">{view.label}</p>
      <blockquote className="sr-surprise-text">{view.text}</blockquote>
      <a href="/surprises" className="sr-surprise-archive-link">
        看收藏 →
      </a>
    </div>
  )
}
