'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

type ThemeRow = {
  id: string
  name: string
  definition: { colors: Record<string, string> }
  is_favorite?: boolean
}

/** 快速切換主題。切換後重新載入讓 SSR 帶出新的 token。 */
export default function ThemeSwitcherWidget({ spaceId, config }: WidgetProps) {
  const limit = (config as { limit?: number } | null)?.limit ?? 6
  const favoritesOnly = (config as { showFavoritesOnly?: boolean } | null)?.showFavoritesOnly

  const [themes, setThemes] = useState<ThemeRow[] | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/themes${favoritesOnly ? '?favorites=true' : ''}`, {
      headers: { 'x-space-id': spaceId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: ThemeRow[] } | null) => {
        if (!cancelled) setThemes(b?.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setThemes([])
      })
    return () => {
      cancelled = true
    }
  }, [spaceId, favoritesOnly])

  async function apply(id: string) {
    setApplying(id)
    const res = await fetch(`/api/themes/${id}/apply`, {
      method: 'POST',
      headers: { 'x-space-id': spaceId },
    })
    if (res.ok) window.location.reload()
    else setApplying(null)
  }

  // 設為 / 取消最愛：樂觀更新，失敗回滾。這是「只顯示我的最愛」篩選能有東西可篩的來源。
  async function toggleFavorite(id: string, next: boolean) {
    setThemes((prev) => prev?.map((t) => (t.id === id ? { ...t, is_favorite: next } : t)) ?? prev)
    try {
      const res = await fetch(`/api/themes/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ isFavorite: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setThemes((prev) => prev?.map((t) => (t.id === id ? { ...t, is_favorite: !next } : t)) ?? prev)
    }
  }

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">主題</h3>

      {themes === null && <p className="sr-muted">載入中…</p>}

      {themes?.length === 0 && (
        <p className="sr-muted">
          還沒有主題。到 Theme Studio 做一套。
        </p>
      )}

      {themes && themes.length > 0 && (
        <ul className="sr-widget-chip-list">
          {themes.slice(0, limit).map((t) => (
            <li key={t.id} className="sr-theme-chip-row">
              <button
                type="button"
                className="sr-theme-chip"
                onClick={() => void apply(t.id)}
                disabled={applying !== null}
              >
                <span
                  className="sr-swatch-row"
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(90deg, ${t.definition.colors['primary']} 0 50%, ${t.definition.colors['background']} 50%)`,
                  }}
                />
                <span>{t.name}</span>
              </button>
              <button
                type="button"
                className="sr-theme-fav"
                aria-pressed={t.is_favorite ?? false}
                aria-label={t.is_favorite ? `取消最愛：${t.name}` : `設為最愛：${t.name}`}
                title={t.is_favorite ? '取消最愛' : '設為最愛'}
                onClick={() => void toggleFavorite(t.id, !t.is_favorite)}
              >
                {t.is_favorite ? '♥' : '♡'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
