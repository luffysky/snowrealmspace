import type { Metadata } from 'next'
import Link from 'next/link'
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
  updated_at: string
  snapshots: Snap[]
}

async function loadPortfolio(slug: string) {
  const db = createPublicClient()
  // anon RLS：只讀得到「有 public 作品」的空間（0049）
  const { data: space } = await db.from('spaces').select('id, name, slug').eq('slug', slug).maybeSingle()
  if (!space) return null
  const { data: works } = await db
    .from('design_files')
    .select('id, title, description, updated_at, snapshots:design_snapshots(id, asset_id, created_at)')
    .eq('space_id', space.id)
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(60)
  return { space, works: (works ?? []) as Work[] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!(await isEnabled('publicPortfolio'))) return {}
  const { slug } = await params
  const data = await loadPortfolio(slug)
  if (!data) return {}
  return { title: `${data.space.name} · 作品集`, description: `${data.space.name} 的公開作品` }
}

function latestSnap(w: Work): Snap | null {
  if (w.snapshots.length === 0) return null
  return [...w.snapshots].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
}

export default async function PortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isEnabled('publicPortfolio'))) notFound() // ADR-018：flag 關 → 404
  const { slug } = await params
  const data = await loadPortfolio(slug)
  if (!data) notFound()
  const { space, works } = data

  return (
    <div className="sr-stack">
      <header>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{space.name}</h1>
        <p className="sr-muted">公開作品集</p>
      </header>

      {works.length === 0 ? (
        <p className="sr-muted">目前還沒有公開的作品。</p>
      ) : (
        <ul className="sr-public-grid">
          {works.map((w) => {
            const snap = latestSnap(w)
            return (
              <li key={w.id} className="sr-public-card">
                <Link href={`/w/${w.id}`} className="sr-public-card-link">
                  {snap ? (
                    <PublicThumb snapshotId={snap.id} alt={w.title} />
                  ) : (
                    <div className="sr-public-thumb sr-public-thumb-empty">尚無圖片</div>
                  )}
                  <span className="sr-public-card-title">{w.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
