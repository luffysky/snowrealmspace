import type { Metadata } from 'next'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { emitEvent } from '@snowrealm/analytics'
import { WIDGET_REGISTRY, GRID, defaultLayoutItems, getWidgetDefinition } from '@snowrealm/widget-engine'
import { createAdminClient } from '@snowrealm/db/server'
import { HomeGrid, type WidgetInstanceRow, type AvailableWidget } from './HomeGrid'
import BirthdayChain from '@/components/widgets/impl/BirthdayChainWidget'
import { WelcomeChain } from '@/components/WelcomeChain'
import { EnvelopeCard } from '@/components/EnvelopeCard'
import { birthdayCardFor } from '@/lib/birthday-cards'
import { getWelcomeLine } from '@snowrealm/daily-engine'

export const metadata: Metadata = { title: 'Home — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { space, settings } = await requireActiveSpace()
  const user = await getUser()
  const db = await getDb()

  // 生日當天判定（用空間時區的當地月日；daily-cron 也是這樣送生日通知）
  const bdParts = new Intl.DateTimeFormat('en-US', {
    timeZone: space.timezone,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())
  const bdMonth = Number(bdParts.find((p) => p.type === 'month')?.value)
  const bdDay = Number(bdParts.find((p) => p.type === 'day')?.value)
  const isBirthdayToday =
    settings.birthday_month != null &&
    settings.birthday_day != null &&
    settings.birthday_month === bdMonth &&
    settings.birthday_day === bdDay

  // 歡迎鏈：非生日時的每日一句歡迎（回家的感覺）
  const welcomeLine = await getWelcomeLine(space.id, space.timezone)

  await emitEvent(
    'space.opened',
    space.id,
    user?.id ?? null,
    { route: '/home' },
    { activityTracking: settings.activity_tracking },
  )

  // 先讀使用中的版面 id
  const { data: spaceRow } = await db
    .from('spaces')
    .select('active_layout_id')
    .eq('id', space.id)
    .maybeSingle()

  // 全部版面（給切換器用）。使用中的那個連同 widget 一起載入。
  const { data: allLayouts } = await db
    .from('layouts')
    .select('id, name, widget_instances(*)')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  let layout =
    allLayouts?.find((l) => l.id === spaceRow?.active_layout_id) ?? allLayouts?.[0] ?? null

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
        .select('id, name, widget_instances(*)')
        .eq('id', created.id)
        .maybeSingle()
      layout = reloaded.data
      // 剛建立的版面要進 allLayouts，否則首次進來切換器是空的
      if (reloaded.data) allLayouts?.push(reloaded.data)
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

      {/*
        生日鏈只在「真的是這個人的生日」那天出現；平常用歡迎鏈（每天一句歡迎）。
        - 壽星（生日主角，暫時：Nami）：先信封卡等她親手收藏；收藏後生日鏈＋歡迎鏈**兩個都給**
          （之後你說要拿掉生日鏈再拿掉）。
        - 其他人：生日當天看生日鏈；其餘日子看歡迎鏈。
        生日鏈內容用 {name} 佔位、依開啟者名字帶入（見 api/chain）。
      */}
      <div data-tour="home-grid" className="sr-stack">
        {settings.is_birthday_recipient ? (
          settings.birthday_card_collected_at ? (
            <>
              <BirthdayChain />
              <WelcomeChain line={welcomeLine} />
            </>
          ) : (
            <EnvelopeCard {...birthdayCardFor(space.id)} savable collectable spaceId={space.id} />
          )
        ) : isBirthdayToday ? (
          <BirthdayChain />
        ) : (
          <WelcomeChain line={welcomeLine} />
        )}
      </div>

      {layout ? (
        <HomeGrid
          key={layout.id}
          spaceId={space.id}
          layoutId={layout.id}
          initialWidgets={(layout.widget_instances ?? []) as unknown as WidgetInstanceRow[]}
          available={available}
          layouts={(allLayouts ?? []).map((l) => ({ id: l.id, name: l.name }))}
          activeLayoutId={layout.id}
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
