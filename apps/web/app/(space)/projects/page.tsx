import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { ProjectsClient, type ProjectRow, type AssetOption } from './ProjectsClient'

export const metadata: Metadata = { title: 'Projects — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const [{ data: projects }, { data: images }] = await Promise.all([
    db
      .from('projects')
      .select(
        'id, name, description, status, cover_asset_id, tags, last_activity_at, created_at, updated_at',
      )
      .eq('space_id', space.id)
      .is('deleted_at', null)
      .order('last_activity_at', { ascending: false })
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
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>專案</h1>
        <p className="sr-muted">
          把作品歸進專案，追蹤每件事的進度。專案刪除後，裡面的作品不會被刪，只會解除歸屬。
        </p>
      </section>

      <ProjectsClient
        spaceId={space.id}
        initialProjects={(projects ?? []) as ProjectRow[]}
        assetOptions={assetOptions}
      />
    </div>
  )
}
