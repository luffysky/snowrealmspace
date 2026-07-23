import type { Metadata } from 'next'
import { ResetForm } from './ResetForm'

export const metadata: Metadata = { title: '重設密碼 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * 重設密碼。使用者從 email 的重設連結回來，/auth/callback 已建立 recovery session，
 * 這裡讓他設定新密碼（action 會驗證 session 是否還在）。
 */
export default function ResetPasswordPage() {
  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-2)' }}>重設密碼</h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          設定一組新密碼，之後就用它登入。
        </p>
        <ResetForm />
      </div>
    </main>
  )
}
