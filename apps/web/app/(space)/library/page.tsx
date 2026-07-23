import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { LibraryClient } from './LibraryClient'
import type { AssetRow } from './AssetGrid'

export const metadata: Metadata = { title: 'Library — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const { data } = await db
    .from('assets')
    .select('id, kind, mime_type, bytes, width, height, original_filename, created_at')
    .eq('space_id', space.id)
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(60)

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>你的檔案</h1>
        <p className="sr-muted">
          上傳圖片後，可以用它生成一整套主題，或設成背景。
        </p>
      </section>

      <LibraryClient spaceId={space.id} initialAssets={(data ?? []) as AssetRow[]} />
    </div>
  )
}
