import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { isSiteAdmin } from '@/lib/auth/site-admin'

export const metadata: Metadata = { title: 'AI 資料聲明 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * AI 資料聲明（v1.0 §32.4）。誠實說明 AI 用到哪些資料、送去哪、留下什麼。
 * 這頁是靜態原則 + 你這個 space 的實際用量，不是行銷話術。
 */
export default async function AiDataPage() {
  const { space, settings } = await requireActiveSpace()
  const db = await getDb()

  const [{ count: usageCount }, { count: memoryCount }] = await Promise.all([
    db.from('ai_usage_log').select('id', { count: 'exact', head: true }).eq('space_id', space.id),
    db
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', space.id)
      .is('deleted_at', null),
  ])
  const siteAdmin = await isSiteAdmin()

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>AI 資料聲明</h1>
        <p className="sr-muted">AI 到底用了你哪些資料、送去哪、留下什麼。這裡不藏。</p>
      </section>

      <section className="sr-card sr-stack">
        <h2 className="sr-section-title">原則</h2>
        <ul className="sr-muted" style={{ margin: 0, paddingLeft: 'var(--sr-space-4)', lineHeight: 1.9 }}>
          <li>AI 分析與記憶<strong>預設關閉</strong>。只有你打開，系統才會做對應的事。</li>
          <li>Agent 只看得到你在該次對話中<strong>明確提供</strong>的內容，不會偷讀其他檔案或對話。</li>
          <li>顏色、對比、留白這類數值一律是<strong>本地計算</strong>（不經 AI），可追溯到來源。</li>
          <li>送去 AI 廠商的只有該次任務所需的文字／圖片；<strong>不含</strong>你的金鑰、其他 space 的內容。</li>
          <li>跨 space <strong>永不共用</strong>非公開的 AI 快取（隱私隔離）。</li>
          <li>記憶只有你<strong>按同意</strong>才會保存；標為「限制」的記憶永不進入對話。</li>
          <li>免費模型優先，只有你要求深入、或需要工具時才用付費模型，且對你可見。</li>
        </ul>
      </section>

      <section className="sr-card sr-stack">
        <h2 className="sr-section-title">這個空間目前的狀態</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--sr-space-2) var(--sr-space-4)', margin: 0 }}>
          <dt className="sr-muted">AI 分析</dt>
          <dd style={{ margin: 0 }}>{settings.ai_analysis_enabled ? '已開啟' : '關閉（預設）'}</dd>
          <dt className="sr-muted">記憶</dt>
          <dd style={{ margin: 0 }}>{settings.memory_enabled ? '已開啟' : '關閉（預設）'}</dd>
          <dt className="sr-muted">AI 呼叫次數</dt>
          <dd style={{ margin: 0 }}>{usageCount ?? 0} 次（可在下方管理）</dd>
          <dt className="sr-muted">已保存記憶</dt>
          <dd style={{ margin: 0 }}>{memoryCount ?? 0} 則</dd>
        </dl>
        <p style={{ margin: 0 }}>
          <Link href="/settings/memory" className="sr-link">
            管理記憶 →
          </Link>
          {'　'}
          <Link href="/settings/data" className="sr-link">
            資料地圖 →
          </Link>
        </p>
      </section>

      {siteAdmin && (
        <section className="sr-card">
          <h2 className="sr-section-title">站台管理</h2>
          <p className="sr-muted" style={{ marginTop: 0 }}>
            管理各家 AI provider 金鑰（加密存 DB，Zeabur 只需一把 <code>AI_KEY_ENCRYPTION_SECRET</code>）。
          </p>
          <p style={{ margin: 0, display: 'flex', gap: 'var(--sr-space-4)', flexWrap: 'wrap' }}>
            <Link href="/admin/ai-keys" className="sr-link">
              AI 金鑰管理後台 →
            </Link>
            <Link href="/admin/ai/usage" className="sr-link">
              AI 用量與成本 →
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
