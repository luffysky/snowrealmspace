'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { effectiveTheme, type ThemeDefinition } from '@snowrealm/theme-engine'
import { applyThemeToPreview } from '@/lib/theme/apply'

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
    // 預覽自己負責把 definition 寫進自己的容器 —— 不依賴父層 effect 的時序，
    // 顏色與「卡片與質感」（圓角/材質/陰影/邊框）都會即時反映。
    const surfaceRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      if (surfaceRef.current) applyThemeToPreview(effectiveTheme(definition, mode), surfaceRef.current)
    }, [definition, mode])
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
