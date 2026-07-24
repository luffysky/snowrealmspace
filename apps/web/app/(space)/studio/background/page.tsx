import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { BackgroundStudio, type AssetOption } from './BackgroundStudio'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import type { Playlist } from './PlaylistPanel'

export const metadata: Metadata = { title: 'Background Studio — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function BackgroundStudioPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const [{ data: backgrounds }, { data: playlists }, { data: assets }] = await Promise.all([
    db
      .from('background_items')
      .select('*')
      .eq('space_id', space.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('background_playlists')
      .select('*, background_playlist_items(id, position, background_item_id)')
      .eq('space_id', space.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    db
      .from('assets')
      .select('id, kind, original_filename')
      .eq('space_id', space.id)
      .in('kind', ['image', 'video'])
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Background Studio</h1>
        <p className="sr-muted">
          把圖片或影片變成背景，調整它的樣子、加霧面玻璃、裁切，再組成會自動輪播的幻燈片。
        </p>
      </section>

      <BackgroundStudio
        spaceId={space.id}
        initialBackgrounds={(backgrounds ?? []) as unknown as BackgroundItem[]}
        initialPlaylists={(playlists ?? []) as unknown as Playlist[]}
        imageAssets={(assets ?? []) as AssetOption[]}
      />
    </div>
  )
}
