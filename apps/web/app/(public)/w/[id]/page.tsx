import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@snowrealm/db/server'
import { isEnabled } from '@/lib/flags'
import { PublicThumb } from '../../PublicThumb'

export const dynamic = 'force-dynamic'

type Snap = { id: string; asset_id: string; created_at: string }
type Work = {
  id: string
  title: string
  description: string | null
  visibility: string
  snapshots: Snap[]
}

async function loadWork(id: string): Promise<Work | null> {
  const db = createPublicClient()
  // anon RLS：只讀得到 public/unlisted（0049）。private 直接查不到 → null → 404。
  const { data } = await db
    .from('design_files')
    .select('id, title, description, visibility, snapshots:design_snapshots(id, asset_id, created_at)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as Work | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!(await isEnabled('publicPortfolio'))) return {}
  const { id } = await params
  const work = await loadWork(id)
  if (!work) return {}
  return { title: work.title, description: work.description ?? undefined }
}

export default async function PublicWorkPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isEnabled('publicPortfolio'))) notFound()
  const { id } = await params
  const work = await loadWork(id)
  if (!work) notFound()

  const snaps = [...work.snapshots].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <article className="sr-stack">
      <header>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{work.title}</h1>
        {work.description && <p className="sr-muted" style={{ whiteSpace: 'pre-wrap' }}>{work.description}</p>}
      </header>

      {snaps.length === 0 ? (
        <p className="sr-muted">這件作品還沒有圖片。</p>
      ) : (
        <div className="sr-stack">
          {snaps.map((s, i) => (
            <figure key={s.id} style={{ margin: 0 }}>
              <PublicThumb snapshotId={s.id} alt={`${work.title} 版本 ${i + 1}`} />
              {snaps.length > 1 && (
                <figcaption className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginTop: '4px' }}>
                  版本 {i + 1}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </article>
  )
}
