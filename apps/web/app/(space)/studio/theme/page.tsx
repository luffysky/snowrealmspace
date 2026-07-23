import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { themeDefinitionSchema, defaultThemeDefinition } from '@snowrealm/theme-engine'
import { ThemeStudio, type SavedTheme } from './ThemeStudio'

export const metadata: Metadata = { title: 'Theme Studio — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function ThemeStudioPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  const { data: rows } = await db
    .from('themes')
    .select('id, name, definition, is_favorite')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(60)

  /*
   * 資料庫裡的 definition 是 jsonb，型別上是 unknown。
   * 這裡逐筆驗證而非直接斷言 —— schema 演進後舊資料可能不再合法，
   * 靜默傳給前端會在渲染時炸掉，且錯誤訊息完全指不到原因。
   */
  const themes: SavedTheme[] = []
  for (const row of rows ?? []) {
    const parsed = themeDefinitionSchema.safeParse(row.definition)
    if (!parsed.success) {
      console.warn('[theme-studio] 略過格式不合的主題', row.id)
      continue
    }
    themes.push({
      id: row.id,
      name: row.name,
      definition: parsed.data,
      is_favorite: row.is_favorite,
    })
  }

  const { data: spaceRow } = await db
    .from('spaces')
    .select('active_theme_id')
    .eq('id', space.id)
    .maybeSingle()

  const activeThemeId = spaceRow?.active_theme_id ?? null

  // 一個主題都沒有時，給一份預設草稿當起點，而不是空白畫面
  if (themes.length === 0) {
    themes.push({
      id: '',
      name: defaultThemeDefinition().name,
      definition: defaultThemeDefinition(),
      is_favorite: false,
    })
    themes.pop()
  }

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Theme Studio</h1>
        <p className="sr-muted">
          調整顏色與質感。右邊會即時顯示套用後的樣子。
        </p>
      </section>

      <ThemeStudio
        spaceId={space.id}
        initialThemes={themes}
        activeThemeId={activeThemeId}
      />
    </div>
  )
}
