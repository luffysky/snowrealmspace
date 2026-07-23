/**
 * 第三方登入入口。13-third-party-auth.md §7。
 *
 * 順序刻意把 email 放在前面（由 page.tsx 決定），因為 Alpha 期間
 * 它是唯一能完成**註冊**的方式。Google / LINE 只能給已有帳號的人登入，
 * 這件事必須在點下去之前就說清楚，而不是點了才發現進不去。
 *
 * 無障礙（ADR-011）：
 *   - 不用純圖示按鈕，一定有文字
 *   - 最小點擊區域 44×44（.sr-button-oauth 在 globals.css 設定）
 */
export function ThirdPartyLogin({
  googleAvailable,
  lineAvailable,
  next,
}: {
  googleAvailable: boolean
  lineAvailable: boolean
  next: string
}) {
  if (!googleAvailable && !lineAvailable) return null

  const q = `?intent=login&next=${encodeURIComponent(next)}`

  return (
    <div style={{ marginTop: 'var(--sr-space-6)' }}>
      <p className="sr-divider-label">或使用</p>

      <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        {googleAvailable && (
          <a className="sr-button sr-button-oauth sr-button-secondary" href={`/api/auth/oauth/google${q}`}>
            以 Google 繼續
          </a>
        )}
        {lineAvailable && (
          <a className="sr-button sr-button-oauth sr-button-line" href={`/api/auth/line/start${q}`}>
            以 LINE 繼續
          </a>
        )}
      </div>

      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', marginBottom: 0 }}>
        目前為邀請制。Google 與 LINE 只能給已經有帳號、且已在設定頁綁定過的人登入。
      </p>
    </div>
  )
}
