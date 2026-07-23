import type { Metadata } from 'next'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { emitEvent } from '@snowrealm/analytics'
import { WIDGET_REGISTRY, GRID, defaultLayoutItems, getWidgetDefinition } from '@snowrealm/widget-engine'
import { createAdminClient } from '@snowrealm/db/server'
import { HomeGrid, type WidgetInstanceRow, type AvailableWidget } from './HomeGrid'

export const metadata: Metadata = { title: 'Home — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { space, settings } = await requireActiveSpace()
  const user = await getUser()
  const db = await getDb()

  await emitEvent(
    'space.opened',
    space.id,
    user?.id ?? null,
    { route: '/home' },
    { activityTracking: settings.activity_tracking },
  )

  let { data: layout } = await db
    .from('layouts')
    .select('id, widget_instances(*)')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  /*
   * 第一次進來時建立預設版面。
   * 用 service role：layouts 的 INSERT 對一般成員開放，但這裡要一併
   * 寫入 widget_instances 與 spaces.active_layout_id，走 admin 較單純。
   */
  if (!layout) {
    const admin = createAdminClient()
    const { data: created } = await admin
      .from('layouts')
      .insert({
        space_id: space.id,
        name: '我的版面',
        is_default: true,
        breakpoint_config: GRID as never,
      })
      .select('id')
      .single()

    if (created) {
      const seeds = defaultLayoutItems().filter((s) => getWidgetDefinition(s.id) !== null)
      if (seeds.length > 0) {
        await admin.from('widget_instances').insert(
          seeds.map((item, index) => ({
            space_id: space.id,
            layout_id: created.id,
            widget_definition_id: item.id,
            position: {
              desktop: { x: item.x, y: item.y, w: item.w, h: item.h },
              mobile: { order: index },
            } as never,
            config: {} as never,
          })),
        )
      }
      await admin.from('spaces').update({ active_layout_id: created.id }).eq('id', space.id)

      const reloaded = await db
        .from('layouts')
        .select('id, widget_instances(*)')
        .eq('id', created.id)
        .maybeSingle()
      layout = reloaded.data
    }
  }

  const available: AvailableWidget[] = Object.values(WIDGET_REGISTRY).map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
  }))

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{space.name}</h1>
      </section>

      {layout ? (
        <HomeGrid
          spaceId={space.id}
          layoutId={layout.id}
          initialWidgets={(layout.widget_instances ?? []) as unknown as WidgetInstanceRow[]}
          available={available}
        />
      ) : (
        <section className="sr-card">
          <p className="sr-muted" style={{ marginBottom: 0 }}>
            版面建立失敗，重新整理再試一次。
          </p>
        </section>
      )}
    </div>
  )
}
