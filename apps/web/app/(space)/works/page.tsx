import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { WorksClient, type WorkFile, type AssetOption } from './WorksClient'

export const metadata: Metadata = { title: '作品 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function WorksPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const [{ data }, { data: images }] = await Promise.all([
    db
      .from('design_files')
      .select(
        'id, title, description, project_id, tags, created_at, updated_at, snapshots:design_snapshots(id, asset_id, created_at)',
      )
      .eq('space_id', space.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100),
    db
      .from('assets')
      .select('id, original_filename')
      .eq('space_id', space.id)
      .eq('kind', 'image')
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const assetOptions: AssetOption[] = (images ?? []).map((a) => ({
    id: a.id,
    label: a.original_filename ?? '未命名圖片',
  }))

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>作品</h1>
        <p className="sr-muted">
          每件作品可以有多個版本。選兩個版本就能並排、疊圖或用滑桿比較，看看改了什麼。
        </p>
      </section>

      <WorksClient
        spaceId={space.id}
        initialFiles={(data ?? []) as WorkFile[]}
        assetOptions={assetOptions}
      />
    </div>
  )
}
