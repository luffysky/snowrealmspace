import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import {
  themeDefinitionSchema,
  defaultThemeDefinition,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'
import { BackgroundStudio, type AssetOption } from './BackgroundStudio'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import type { Playlist } from './PlaylistPanel'
import { isEnabled } from '@/lib/flags'

export const metadata: Metadata = { title: 'Background Studio — SnowRealm-Space' }
export const dynamic = 'force-dynamic'

export default async function BackgroundStudioPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  // videoBackground flag 關閉時：不列出影片素材、也不提供影片背景（與後端端點一致）
  const videoEnabled = await isEnabled('videoBackground', space.id)
  const assetKinds = videoEnabled ? ['image', 'video'] : ['image']

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
      .in('kind', assetKinds)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // 目前套用的主題（給預覽把背景疊在主題上，並能切淺/深模式）
  let activeTheme: ThemeDefinition = defaultThemeDefinition()
  const { data: spaceRow } = await db
    .from('spaces')
    .select('active_theme_id, bg_light_item_id, bg_dark_item_id')
    .eq('id', space.id)
    .maybeSingle()
  if (spaceRow?.active_theme_id) {
    const { data: theme } = await db
      .from('themes')
      .select('definition')
      .eq('id', spaceRow.active_theme_id)
      .is('deleted_at', null)
      .maybeSingle()
    const parsed = themeDefinitionSchema.safeParse(theme?.definition)
    if (parsed.success) activeTheme = parsed.data
  }

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Background Studio</h1>
        <p className="sr-muted">
          把{videoEnabled ? '圖片或影片' : '圖片'}變成背景，調整它的樣子、加霧面玻璃、裁切，再組成會自動輪播的幻燈片。
        </p>
      </section>

      <BackgroundStudio
        spaceId={space.id}
        initialBackgrounds={(backgrounds ?? []) as unknown as BackgroundItem[]}
        initialPlaylists={(playlists ?? []) as unknown as Playlist[]}
        imageAssets={(assets ?? []) as AssetOption[]}
        activeTheme={activeTheme}
        initialBgLightId={spaceRow?.bg_light_item_id ?? null}
        initialBgDarkId={spaceRow?.bg_dark_item_id ?? null}
      />
    </div>
  )
}
