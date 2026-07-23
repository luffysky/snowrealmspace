'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ThemeDefinition } from '@snowrealm/theme-engine'
import { loadFontFaces, type FontManifestEntry } from '@/lib/theme/font-loader'

/**
 * 字體選擇。實作 ADR-016 的 UI 部分。
 *
 * ## 為什麼要顯示大小
 *
 * 一組字體配對可能載入 4 套字體、229 KB（見 unicode-ranges.ts 的實測）。
 * 那是使用者的選擇 —— 手寫體排日記就是比黑體好 ——
 * 但他必須看得到代價。靜靜地讓人多等 130 KB 才是問題。
 */

type ApiFont = {
  id: string
  slug: string
  family: string
  category: string
  scripts: string[]
  weights: number[]
  previewText: string | null
  fallbackStack: string
  license: { name: string; url: string }
  firstScreenBytes: number
  files: Record<string, { file: string; unicodeRange: string; critical: boolean }[]>
}

type ApiPair = {
  id: string
  name: string
  headingFontId: string
  bodyFontId: string
  uiFontId: string
  moodTags: string[]
}

type Role = 'heading' | 'body' | 'ui'

const ROLE_LABEL: Record<Role, string> = {
  heading: '標題',
  body: '內文',
  ui: '介面',
}

const ROLE_HINT: Record<Role, string> = {
  heading: '大字用。裝飾性強的字體只適合放這裡。',
  body: '長文用。這一項最影響閱讀，選好認的。',
  ui: '按鈕、標籤、輸入框。',
}

const CATEGORY_LABEL: Record<string, string> = {
  sans: '黑體',
  serif: '宋體 / 襯線',
  display: '標題體',
  handwriting: '手寫 / 楷體',
  mono: '等寬',
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`
}

export function FontPanel({
  draft,
  onChange,
}: {
  draft: ThemeDefinition
  onChange: (patch: (prev: ThemeDefinition) => ThemeDefinition) => void
}) {
  const [fonts, setFonts] = useState<ApiFont[] | null>(null)
  const [pairs, setPairs] = useState<ApiPair[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/fonts')
      if (cancelled) return
      if (!res.ok) {
        setError('讀不到字體清單。')
        setFonts([])
        return
      }
      const body = (await res.json()) as { data: { fonts: ApiFont[]; pairs: ApiPair[] } }
      if (cancelled) return
      setFonts(body.data.fonts)
      setPairs(body.data.pairs)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * fontId 可能是 uuid（使用者存的主題）也可能是 slug（預設主題與 preset）。
   * 只用 uuid 查會讓預設主題的三個角色全部查不到 ——
   * 下拉選單的選取值對不上任何 option、樣張不顯示、授權清單是空的。
   * 這個 bug 不會報錯，只會安靜地什麼都不對。
   */
  const byId = useMemo(() => {
    const map = new Map<string, ApiFont>()
    for (const font of fonts ?? []) {
      map.set(font.id, font)
      map.set(font.slug, font)
    }
    return map
  }, [fonts])

  /** 下拉選單的 value 一律用 uuid，避免同一套字體有兩種 key。 */
  const valueFor = (id: string) => byId.get(id)?.id ?? ''

  // 預覽需要真的載入字體，否則所有選項看起來一模一樣
  useEffect(() => {
    if (!fonts || fonts.length === 0) return
    const used = [draft.typography.headingFontId, draft.typography.bodyFontId, draft.typography.uiFontId]
    const entries = [...new Set(used)]
      .map((id) => byId.get(id))
      .filter((f): f is ApiFont => f !== undefined)
      .map(toManifestEntry)
    if (entries.length > 0) loadFontFaces(entries)
  }, [fonts, byId, draft.typography])

  const selected = useMemo(
    () =>
      [
        draft.typography.headingFontId,
        draft.typography.bodyFontId,
        draft.typography.uiFontId,
      ].map((id) => byId.get(id)),
    [byId, draft.typography],
  )

  const totalBytes = useMemo(() => {
    const seen = new Set<string>()
    let sum = 0
    for (const font of selected) {
      if (!font || seen.has(font.slug)) continue
      seen.add(font.slug)
      sum += font.firstScreenBytes
    }
    return sum
  }, [selected])

  function setRole(role: Role, fontId: string) {
    onChange((prev) => {
      const key = `${role}FontId` as const
      return { ...prev, typography: { ...prev.typography, [key]: fontId } }
    })
  }

  function applyPair(pair: ApiPair) {
    onChange((prev) => ({
      ...prev,
      typography: {
        ...prev.typography,
        headingFontId: pair.headingFontId,
        bodyFontId: pair.bodyFontId,
        uiFontId: pair.uiFontId,
      },
    }))
  }

  if (error) {
    return (
      <section className="sr-card">
        <h2 className="sr-section-title">字體</h2>
        <p className="sr-message sr-message-error" role="alert">
          ✕ {error}
        </p>
      </section>
    )
  }

  if (!fonts) {
    return (
      <section className="sr-card">
        <h2 className="sr-section-title">字體</h2>
        <p className="sr-muted" aria-live="polite">
          載入中…
        </p>
      </section>
    )
  }

  // 字體還沒上傳時誠實說明，不要給一個空的下拉選單（Q6：無假東西）
  if (fonts.length === 0) {
    return (
      <section className="sr-card">
        <h2 className="sr-section-title">字體</h2>
        <p className="sr-muted">
          目前沒有可用的字體。需要先執行 <code>pnpm fonts:download</code>、
          <code>pnpm fonts:build</code>、<code>pnpm fonts:upload</code>。
        </p>
      </section>
    )
  }

  return (
    <section className="sr-card">
      <h2 className="sr-section-title">字體</h2>

      {pairs.length > 0 && (
        <>
          <h3 className="sr-subsection-title">配對</h3>
          <p className="sr-muted" style={{ marginTop: 0 }}>
            一次設定三個角色。之後仍可個別調整。
          </p>
          <ul className="sr-font-pairs" role="list">
            {pairs.map((pair) => {
              const slugs = new Set(
                [pair.headingFontId, pair.bodyFontId, pair.uiFontId]
                  .map((id) => byId.get(id)?.slug)
                  .filter(Boolean),
              )
              const cost = [...slugs].reduce((sum, slug) => {
                const f = fonts.find((x) => x.slug === slug)
                return sum + (f?.firstScreenBytes ?? 0)
              }, 0)

              return (
                <li key={pair.id}>
                  <button
                    type="button"
                    className="sr-button sr-button-secondary"
                    onClick={() => applyPair(pair)}
                  >
                    {pair.name}
                    <span className="sr-muted" style={{ marginLeft: 'var(--sr-space-2)' }}>
                      {kb(cost)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3 className="sr-subsection-title">個別設定</h3>

      {(['heading', 'body', 'ui'] as Role[]).map((role) => {
        const currentId = draft.typography[`${role}FontId`]
        const current = byId.get(currentId)

        return (
          <div key={role} className="sr-field">
            <label className="sr-label" htmlFor={`font-${role}`}>
              {ROLE_LABEL[role]}
            </label>
            <p className="sr-muted" id={`font-${role}-hint`} style={{ margin: 0 }}>
              {ROLE_HINT[role]}
            </p>
            <select
              id={`font-${role}`}
              className="sr-input"
              aria-describedby={`font-${role}-hint`}
              value={valueFor(currentId)}
              onChange={(e) => setRole(role, e.target.value)}
            >
              {Object.entries(CATEGORY_LABEL).map(([category, label]) => {
                const group = fonts.filter((f) => f.category === category)
                if (group.length === 0) return null
                return (
                  <optgroup key={category} label={label}>
                    {group.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.family}（{kb(f.firstScreenBytes)}）
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>

            {current && (
              <p
                className="sr-font-sample"
                // 預覽必須用真正的字體，否則所有選項長得一樣
                style={{ fontFamily: `"${current.family}", ${current.fallbackStack}` }}
              >
                {current.previewText ?? '雪境是一個會隨時間長大的空間'}
              </p>
            )}
          </div>
        )
      })}

      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }}>
        這組字體首次載入約 <strong>{kb(totalBytes)}</strong>
        {totalBytes > 100 * 1024 && '，比建議值高。用了越多套不同字體就越多。'}
      </p>

      <details style={{ marginTop: 'var(--sr-space-3)' }}>
        <summary className="sr-muted">授權</summary>
        <ul className="sr-muted" style={{ marginTop: 'var(--sr-space-2)' }}>
          {[...new Set(selected.filter(Boolean).map((f) => f!.slug))].map((slug) => {
            const font = fonts.find((f) => f.slug === slug)!
            return (
              <li key={slug}>
                {font.family} —{' '}
                <a href={font.license.url} target="_blank" rel="noreferrer noopener">
                  {font.license.name}
                </a>
              </li>
            )
          })}
        </ul>
      </details>
    </section>
  )
}

function toManifestEntry(font: ApiFont): FontManifestEntry {
  return {
    slug: font.slug,
    family: font.family,
    fallbackStack: font.fallbackStack,
    weights: font.weights,
    files: font.files,
  }
}
