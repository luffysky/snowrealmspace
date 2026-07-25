import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@snowrealm/db/server'
import { PublicThumb } from '../../PublicThumb'

export const dynamic = 'force-dynamic'

type Snap = { id: string; created_at: string }
type Work = {
  id: string
  title: string
  description: string | null
  deleted_at: string | null
  snapshots: Snap[]
}

/**
 * 分享連結頁：token 即授權。用 service role 驗證 token（未撤銷/未過期）後，
 * 讀出作品（即使是 private）唯讀呈現。圖片走 /api/public/asset-url?token=。
 */
async function loadShare(token: string): Promise<Work | null> {
  const admin = createAdminClient()
  const { data: link } = await admin
    .from('share_links')
    .select('design_file_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!link || link.revoked_at) return null
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return null

  const { data: work } = await admin
    .from('design_files')
    .select('id, title, description, deleted_at, snapshots:design_snapshots(id, created_at)')
    .eq('id', link.design_file_id)
    .maybeSingle()
  if (!work || work.deleted_at) return null
  return work as Work
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const work = await loadShare(token)
  return work ? { title: work.title, robots: { index: false } } : {}
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const work = await loadShare(token)
  if (!work) notFound()

  const snaps = [...work.snapshots].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <article className="sr-stack">
      <header>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{work.title}</h1>
        {work.description && <p className="sr-muted" style={{ whiteSpace: 'pre-wrap' }}>{work.description}</p>}
        <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>有人把這件作品分享給你（唯讀）。</p>
      </header>

      {snaps.length === 0 ? (
        <p className="sr-muted">這件作品還沒有圖片。</p>
      ) : (
        <div className="sr-stack">
          {snaps.map((s, i) => (
            <figure key={s.id} style={{ margin: 0 }}>
              <PublicThumb snapshotId={s.id} alt={`${work.title} 版本 ${i + 1}`} token={token} />
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
