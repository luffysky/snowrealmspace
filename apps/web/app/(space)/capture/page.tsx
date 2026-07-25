import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { CaptureInbox, type CaptureRow } from './CaptureInbox'

export const metadata: Metadata = { title: '捕捉 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function CapturePage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()
  const { data } = await db
    .from('capture_inbox')
    .select('id, body, source, status, created_at')
    .eq('space_id', space.id)
    .eq('status', 'inbox')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>捕捉</h1>
        <p className="sr-muted">
          隨手把念頭丟進來，之後再慢慢沉澱——轉成筆記、或先收起來。之後鍵盤與 Agent 也能直接丟進這裡。
        </p>
      </section>
      <CaptureInbox spaceId={space.id} initial={(data ?? []) as CaptureRow[]} />
    </div>
  )
}
