import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { NotesManager, type Note } from './NotesManager'

export const metadata: Metadata = { title: '筆記 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function NotesPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()
  const { data } = await db
    .from('notes')
    .select('id, title, body, created_at, updated_at')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200)

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>筆記</h1>
        <p className="sr-muted">
          隨手記下的東西都在這裡，可以增刪改。Home 的「隨手記」小工具也是寫進這裡。
        </p>
      </section>
      <NotesManager spaceId={space.id} initial={(data ?? []) as Note[]} />
    </div>
  )
}
