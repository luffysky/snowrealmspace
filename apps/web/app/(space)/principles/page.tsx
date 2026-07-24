import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { PrinciplesClient, type PrincipleRow } from './PrinciplesClient'

export const metadata: Metadata = { title: '設計原則 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function PrinciplesPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const { data } = await db
    .from('design_principles')
    .select('id, title, body, category, position, created_at, updated_at')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>設計原則</h1>
        <p className="sr-muted">
          寫下你自己的創作準則 —— 你在意的排版、配色、留白、字體…。這些是你的品味，
          Agent 在給建議時會參考它們，而不是套通用說法。
        </p>
      </section>

      <PrinciplesClient spaceId={space.id} initialPrinciples={(data ?? []) as PrincipleRow[]} />
    </div>
  )
}
