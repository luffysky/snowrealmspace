import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { AiKeysAdmin } from './AiKeysAdmin'

export const metadata: Metadata = { title: 'AI 金鑰管理 — SnowRealm' }
export const dynamic = 'force-dynamic'

/**
 * 站台後台：AI provider 金鑰管理（照 ai 島架構）。
 * 各家金鑰存 DB（AES-256-GCM 加密），Zeabur 只需一把 AI_KEY_ENCRYPTION_SECRET。
 * 站台管理員身份（多 signal，見 lib/auth/site-admin）。
 */
export default async function AdminAiKeysPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    // 未登入 → 登入頁；已登入但非管理員 → 首頁
    redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/ai-keys' : '/home')
  }

  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: 'var(--sr-space-6, 32px) var(--sr-space-4, 16px)',
      }}
    >
      <h1 style={{ fontSize: 'var(--sr-text-h1, 1.8rem)' }}>AI 金鑰管理</h1>
      <p className="sr-muted">
        各家 provider 金鑰加密存在資料庫，Zeabur 只要放一把 <code>AI_KEY_ENCRYPTION_SECRET</code>。
        免費優先——設好 Groq + Gemini 兩把免費金鑰，Agent 對話就能運作。
      </p>
      <AiKeysAdmin />
    </main>
  )
}
