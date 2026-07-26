'use client'

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { effectiveTheme, type ThemeDefinition } from '@snowrealm/theme-engine'
import { applyThemeToPreview } from '@/lib/theme/apply'
import { applyFontVars, loadFontFaces, type FontManifestEntry } from '@/lib/theme/font-loader'

/** /api/fonts 回傳的欄位（只取字體套用需要的）。 */
type CatalogueFont = {
  id: string
  slug: string
  family: string
  fallbackStack: string
  weights: number[]
  files: Record<string, { file: string; unicodeRange: string; critical: boolean }[]>
}

function toEntry(f: CatalogueFont): FontManifestEntry {
  return {
    slug: f.slug,
    family: f.family,
    fallbackStack: f.fallbackStack,
    weights: f.weights,
    files: f.files,
  }
}

/**
 * 即時預覽。
 *
 * 這個容器由 applyThemeToPreview 直接寫入 CSS 變數，
 * 所以裡面的元素只要用 var(--sr-*) 就會自動反映草稿 ——
 * 不需要把顏色當 props 傳進來，也不需要重新渲染。
 *
 * 預覽內容刻意涵蓋所有會被對比檢查的元素：
 * 一般文字、次要文字、主色按鈕、錯誤訊息、focus 外框、disabled 狀態。
 * 使用者調色時能立刻看到後果，而不是只看到抽象的色票。
 *
 * 淺色／深色 tab：用 effectiveTheme 依草稿推導對應模式，讓使用者不用真的切換
 * 整站就能看到「這套主題在深色模式下長怎樣」。
 */
export const ThemePreview = forwardRef<HTMLDivElement, { definition: ThemeDefinition }>(
  function ThemePreview({ definition }, ref) {
    const [mode, setMode] = useState<'light' | 'dark'>('light')
    const surfaceRef = useRef<HTMLDivElement | null>(null)

    // 字體目錄（一次載入）。字體不隨淺/深模式變。
    const [fonts, setFonts] = useState<CatalogueFont[] | null>(null)
    useEffect(() => {
      let cancelled = false
      void (async () => {
        const res = await fetch('/api/fonts')
        if (cancelled || !res.ok) return
        const body = (await res.json()) as { data: { fonts: CatalogueFont[] } }
        if (!cancelled) setFonts(body.data.fonts)
      })()
      return () => {
        cancelled = true
      }
    }, [])

    // id 或 slug 都能查（使用者主題存 uuid，內建主題存 slug）
    const byKey = useMemo(() => {
      const m = new Map<string, CatalogueFont>()
      for (const f of fonts ?? []) {
        m.set(f.id, f)
        m.set(f.slug, f)
      }
      return m
    }, [fonts])

    // 預覽自己負責把 definition 寫進自己的容器 —— 不依賴父層 effect 的時序，
    // 顏色、「卡片與質感」（圓角/材質/陰影/邊框）與字體都即時反映。
    //
    // 顏色與字體**必須在同一個 effect**：applyThemeToPreview 是 `style.cssText = …`
    // 全量覆寫，會把字體變數一起清掉。若拆兩個 effect，切換淺/深模式時只有顏色那個
    // 會重跑 → 字體變數被清掉卻沒補回來。所以先套顏色、緊接著補字體。
    useEffect(() => {
      const surface = surfaceRef.current
      if (!surface) return
      applyThemeToPreview(effectiveTheme(definition, mode), surface)

      if (!fonts) return
      const heading = byKey.get(definition.typography.headingFontId)
      const body = byKey.get(definition.typography.bodyFontId)
      const ui = byKey.get(definition.typography.uiFontId)
      // 三個角色缺任何一個就不動字體（維持繼承），避免只換一半更難看。
      // globals.css 讀的是 --sr-font-body/-heading/-ui，不是 compileThemeToCssVars
      // 產的 -id placeholder —— 少了這段，選字體時預覽不會有任何變化。
      if (!heading || !body || !ui) return
      loadFontFaces([...new Set([heading, body, ui])].map(toEntry))
      applyFontVars({ heading: toEntry(heading), body: toEntry(body), ui: toEntry(ui) }, surface)
      // surface 自己也要吃 body 變數，內文才會跟著換（標題各自用 var(--sr-font-heading)）
      surface.style.fontFamily = 'var(--sr-font-body)'
      surface.style.fontWeight = 'var(--sr-weight-body)'
    }, [definition, mode, fonts, byKey])
    const setRef = (el: HTMLDivElement | null) => {
      surfaceRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
    }
    return (
      <div className="sr-preview-frame">
        <div className="sr-preview-topline">
          <p className="sr-muted sr-preview-caption">即時預覽 —— 這裡的樣子就是套用後的樣子</p>
          <div className="sr-mode-tabs" role="tablist" aria-label="預覽模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'light'}
              className={`sr-mode-tab ${mode === 'light' ? 'is-active' : ''}`}
              onClick={() => setMode('light')}
            >
              淺色
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'dark'}
              className={`sr-mode-tab ${mode === 'dark' ? 'is-active' : ''}`}
              onClick={() => setMode('dark')}
            >
              深色
            </button>
          </div>
        </div>

        <div ref={setRef} className="sr-preview-surface">
          <div className="sr-preview-inner">
            <header className="sr-preview-header">
              <strong className="sr-preview-title">{definition.name || '未命名主題'}</strong>
              <span className="sr-preview-role">擁有者</span>
            </header>

            <section className="sr-card">
              <h3 className="sr-preview-h">今天</h3>
              <p className="sr-preview-body">
                這個空間現在還是空的。接下來的每一樣東西，都會是你自己放進去的。
              </p>
              <p className="sr-muted">次要文字看起來會是這樣。</p>

              <div className="sr-row" style={{ marginTop: 'var(--sr-space-4)' }}>
                <button type="button" className="sr-button">
                  主要動作
                </button>
                <button type="button" className="sr-button sr-button-secondary">
                  次要動作
                </button>
                <button type="button" className="sr-button" disabled>
                  停用
                </button>
              </div>
            </section>

            <section className="sr-card">
              <h3 className="sr-preview-h">狀態訊息</h3>
              <p className="sr-message sr-message-success">✓ 成功的訊息長這樣。</p>
              <p className="sr-message sr-message-error">✕ 錯誤的訊息長這樣。</p>
              <p className="sr-message sr-message-info">ⓘ 一般提示長這樣。</p>

              <label className="sr-label" htmlFor="preview-input">
                輸入框
              </label>
              <input
                id="preview-input"
                className="sr-input"
                placeholder="點一下看 focus 外框"
                readOnly
              />
              <p className="sr-muted">
                用 Tab 鍵移到上面的輸入框，可以看到 focus 外框的實際效果。
              </p>
            </section>
          </div>
        </div>
      </div>
    )
  },
)
