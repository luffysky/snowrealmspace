'use client'

import { useState } from 'react'
import { deriveDarkTheme, type ThemeDefinition } from '@snowrealm/theme-engine'
import { applyThemeToDom } from '@/lib/theme/apply'
import { MODE_COOKIE, MODE_MAX_AGE, type ColorMode } from '@/lib/theme/mode'

/**
 * 深／淺色切換。
 *
 * 明暗與主題分開：任何主題都能切暗色版（deriveDarkTheme 保留色相與個性）。
 * 切換 < 150ms：直接 applyThemeToDom 改 :root 的 inline style，不重渲染整棵樹。
 * 記在 cookie，SSR 首屏就用對的模式，不閃。
 */
export function ThemeModeToggle({
  initialMode,
  lightDef,
}: {
  initialMode: ColorMode
  lightDef: ThemeDefinition
}) {
  const [mode, setMode] = useState<ColorMode>(initialMode)

  function toggle() {
    const next: ColorMode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    document.cookie = `${MODE_COOKIE}=${next};path=/;max-age=${MODE_MAX_AGE};samesite=lax`
    applyThemeToDom(next === 'dark' ? deriveDarkTheme(lightDef) : lightDef)
  }

  const dark = mode === 'dark'
  return (
    <button
      type="button"
      className="sr-button sr-button-secondary sr-icon-button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? '切換到淺色模式' : '切換到深色模式'}
      title={dark ? '淺色模式' : '深色模式'}
    >
      {dark ? (
        // 太陽（目前暗色 → 點了變亮）
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // 月亮（目前亮色 → 點了變暗）
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8 8 0 019.5 4a7 7 0 108.6 10.6 8 8 0 001.9-.1z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
