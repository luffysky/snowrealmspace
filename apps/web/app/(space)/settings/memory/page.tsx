import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { MemoryCenter, type MemoryRow } from './MemoryCenter'

export const metadata: Metadata = { title: '記憶 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * Memory Center（v1.0 §21 / ADR-014）。查看、編輯、刪除、匯出使用者批准的記憶，
 * 以及批准/拒絕 Agent 的提案。記憶預設關閉；關閉時仍能查看與刪除既有記憶。
 */
export default async function MemoryPage() {
  const { space, settings } = await requireActiveSpace()
  const db = await getDb()

  const { data } = await db
    .from('memories')
    .select('id, type, content, source_type, sensitivity, approved, created_at, updated_at')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as MemoryRow[]

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>記憶</h1>
        <p className="sr-muted">
          這裡是 Agent 記得的事 —— 只有你批准的才會被保存與使用。你隨時可以編輯、刪除或全部清空。
        </p>
      </section>

      <MemoryCenter
        spaceId={space.id}
        initialMemories={rows}
        memoryEnabled={settings.memory_enabled}
      />
    </div>
  )
}
