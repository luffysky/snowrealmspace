'use client'

import { useEffect, useState } from 'react'
import type { ThemeDefinition, A11yReport } from '@snowrealm/theme-engine'
import type { AssetRow } from './AssetGrid'

type Draft = {
  variant: string
  definition: ThemeDefinition
  a11yReport: A11yReport
}

type Palette = {
  dominant: string
  secondary: string
  accent: string
  darkest: string
  lightest: string
  swatches: { color: string; weight: number }[]
}

/**
 * 從圖片生成主題。v1.0 §7.3。
 *
 * ADR-012：色票是本地演算法算的，同步回傳、零成本、可重現。
 * 這裡不會出現「AI 正在思考」的等待畫面 —— 因為根本沒有 AI 參與。
 */
export function ThemeFromImage({
  spaceId,
  asset,
  onClose,
  onCreated,
}: {
  spaceId: string
  asset: AssetRow
  onClose: () => void
  onCreated: () => void
}) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [palette, setPalette] = useState<Palette | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDrafts(null)
    setError(null)
    setWaiting(false)

    /**
     * 剛上傳完就開啟時，worker 可能還沒跑完分析。
     * 那不是錯誤而是等待 —— 輪詢到就緒為止，最多 40 秒。
     */
    async function load(attempt = 0): Promise<void> {
      const res = await fetch('/api/themes/from-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ assetId: asset.id, variants: 3 }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (cancelled) return

      if (!res.ok) {
        const err = (body as { error?: { message?: string; details?: { retryable?: boolean } } } | null)
          ?.error

        if (err?.details?.retryable && attempt < 26) {
          setWaiting(true)
          setTimeout(() => void load(attempt + 1), 1500)
          return
        }

        setWaiting(false)
        setError(err?.message ?? '無法從這張圖生成主題。')
        return
      }

      const data = (body as { data: { drafts: Draft[]; palette: Palette } }).data
      setWaiting(false)
      setDrafts(data.drafts)
      setPalette(data.palette)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [spaceId, asset.id])

  async function save(draft: Draft) {
    setSaving(draft.variant)
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({
          name: draft.definition.name,
          definition: draft.definition,
          source: 'from_image',
          sourceAssetId: asset.id,
        }),
      })
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null)
        setError(
          (body as { error?: { message?: string } } | null)?.error?.message ?? '儲存失敗。',
        )
        return
      }
      onCreated()
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="sr-card" aria-labelledby="from-image-title">
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="sr-section-title" id="from-image-title" style={{ marginBottom: 0 }}>
          從「{asset.original_filename ?? '這張圖'}」生成主題
        </h2>
        <button type="button" className="sr-button sr-button-secondary" onClick={onClose}>
          關閉
        </button>
      </div>

      {error && (
        <p className="sr-message sr-message-error" role="alert" style={{ marginTop: 'var(--sr-space-4)' }}>
          ✕ {error}
        </p>
      )}

      {palette && (
        <div style={{ marginTop: 'var(--sr-space-4)' }}>
          <p className="sr-label" style={{ marginBottom: 'var(--sr-space-2)' }}>
            抽出的色票
          </p>
          <div className="sr-row" role="list">
            {palette.swatches.map((s) => (
              <span
                key={s.color}
                role="listitem"
                className="sr-palette-chip"
                // 這是分析結果的呈現，不是主題 token
                style={{ background: s.color }}
                title={`${s.color}（${Math.round(s.weight * 100)}%）`}
              >
                <span className="sr-visually-hidden">
                  {s.color}，佔 {Math.round(s.weight * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {!drafts && !error && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }} aria-live="polite">
          {waiting ? '圖片還在分析中，稍等一下…' : '計算中…'}
        </p>
      )}

      {drafts && (
        <ul className="sr-draft-grid">
          {drafts.map((draft) => (
            <li key={draft.variant} className="sr-draft">
              <span
                className="sr-draft-preview"
                aria-hidden="true"
                style={{
                  background: draft.definition.colors.background,
                  borderColor: draft.definition.colors.border,
                }}
              >
                <span
                  className="sr-draft-bar"
                  style={{ background: draft.definition.colors.primary }}
                />
                <span
                  className="sr-draft-text"
                  style={{ color: draft.definition.colors.textPrimary }}
                >
                  文字看起來像這樣
                </span>
                <span
                  className="sr-draft-text sr-draft-text-secondary"
                  style={{ color: draft.definition.colors.textSecondary }}
                >
                  次要文字
                </span>
              </span>

              <strong>{draft.variant}</strong>

              <p className="sr-muted" style={{ margin: 0 }}>
                {draft.a11yReport.passesAA
                  ? `✓ 對比達標（最低 ${draft.a11yReport.worstRatio}:1）`
                  : `✕ 有 ${draft.a11yReport.failing.length} 組對比不足`}
              </p>

              <button
                type="button"
                className="sr-button"
                onClick={() => void save(draft)}
                disabled={saving !== null}
              >
                {saving === draft.variant ? '儲存中…' : '存成主題'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
