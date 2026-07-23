'use client'

import { forwardRef } from 'react'
import type { ThemeDefinition } from '@snowrealm/theme-engine'

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
 */
export const ThemePreview = forwardRef<HTMLDivElement, { definition: ThemeDefinition }>(
  function ThemePreview({ definition }, ref) {
    return (
      <div className="sr-preview-frame">
        <p className="sr-muted sr-preview-caption">
          即時預覽 —— 這裡的樣子就是套用後的樣子
        </p>

        <div ref={ref} className="sr-preview-surface">
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
