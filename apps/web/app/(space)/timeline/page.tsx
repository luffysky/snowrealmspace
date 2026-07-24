import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { TimelineClient, type TimelineRow, type ProjectLabel } from './TimelineClient'

export const metadata: Metadata = { title: '時間軸 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const [{ data: events }, { data: projects }] = await Promise.all([
    db
      .from('timeline_events')
      .select('id, event_type, title, body, cover_asset_id, project_id, visibility, occurred_at')
      .eq('space_id', space.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(100),
    db
      .from('projects')
      .select('id, name')
      .eq('space_id', space.id)
      .is('deleted_at', null),
  ])

  const projectLabels: ProjectLabel[] = (projects ?? []).map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>時間軸</h1>
        <p className="sr-muted">
          你在這個空間做過的事，會自動出現在這裡。每一筆都可以改標題、隱藏或刪除。
        </p>
      </section>

      <TimelineClient
        spaceId={space.id}
        initialEvents={(events ?? []) as TimelineRow[]}
        projects={projectLabels}
      />
    </div>
  )
}
