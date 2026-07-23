import type { Metadata } from 'next'
import { ForgotForm } from './ForgotForm'

export const metadata: Metadata = { title: '忘記密碼 — SnowRealm Space' }

export default function ForgotPage() {
  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-2)' }}>忘記密碼</h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          輸入帳號綁定的 email，我們寄一條重設連結給你。
          用純使用者名稱註冊、沒綁 email 的帳號，請改用 Google／LINE 登入。
        </p>
        <ForgotForm />
      </div>
    </main>
  )
}
