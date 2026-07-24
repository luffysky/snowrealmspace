import type { Metadata } from 'next'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { updatePrivacySettings } from './actions'
import Link from 'next/link'
import { PrivacyToggles } from './PrivacyToggles'
import { AgentSettings } from './AgentSettings'
import { BackgroundMusicSettings, type AudioOption } from './BackgroundMusicSettings'

export const metadata: Metadata = { title: 'Settings — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * Milestone A 只做隱私分頁 —— 因為那是唯一「現在就有實際作用」的設定。
 * Appearance / Agent 分頁要等 Milestone B / D 才有東西可調，
 * 所以現在不放（Q6：無假按鈕）。
 */
export default async function SettingsPage() {
  const { space, settings, role } = await requireActiveSpace()
  const user = await getUser()

  const db = await getDb()
  const { data: audioAssets } = await db
    .from('assets')
    .select('id, original_filename')
    .eq('space_id', space.id)
    .eq('kind', 'audio')
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  const audioOptions: AudioOption[] = (audioAssets ?? []).map((a) => ({
    id: a.id,
    label: a.original_filename ?? '未命名音訊',
  }))

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>設定</h1>
        <p className="sr-muted">{user?.email}</p>
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>登入方式</h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          可以綁定 Google 或 LINE，之後用它們登入的是同一個帳號。
        </p>
        <Link className="sr-button sr-button-secondary" href="/settings/account">
          管理登入方式
        </Link>
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>
          每日與回顧
        </h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          每天打開的驚喜、以及根據你活動整理的每週回顧。
        </p>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
          <Link className="sr-button sr-button-secondary" href="/insights">
            每週回顧
          </Link>
          <Link className="sr-button sr-button-secondary" href="/surprises">
            驚喜收藏
          </Link>
        </div>
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>
          Agent 與通知
        </h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          Agent 偶爾會主動說一句有根據的話。你可以調整頻率或完全關閉。
        </p>
        <AgentSettings
          spaceId={space.id}
          canEdit={role === 'owner'}
          initial={{
            agentProactive: settings.agent_proactive,
            quietStart: (settings.quiet_hours_start ?? '').slice(0, 5),
            quietEnd: (settings.quiet_hours_end ?? '').slice(0, 5),
          }}
        />
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>
          背景音樂
        </h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          想要的話，可以幫這個空間配一段背景音樂。要不要放、放哪一首，都由你決定。
        </p>
        <BackgroundMusicSettings
          spaceId={space.id}
          canEdit={role === 'owner'}
          audioOptions={audioOptions}
          initial={{
            enabled: settings.background_audio_enabled ?? false,
            assetId: settings.background_audio_asset_id ?? null,
            volume: settings.background_audio_volume ?? 0.5,
          }}
        />
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>隱私</h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          這些預設是關閉的。只有你打開，系統才會做對應的事。
        </p>

        <PrivacyToggles
          spaceId={space.id}
          canEdit={role === 'owner'}
          initial={{
            activityTracking: settings.activity_tracking,
            memoryEnabled: settings.memory_enabled,
            aiAnalysisEnabled: settings.ai_analysis_enabled,
            providerDataEnabled: settings.provider_data_enabled,
          }}
          action={updatePrivacySettings}
        />

        <p style={{ marginTop: 'var(--sr-space-4)', marginBottom: 0 }}>
          <Link href="/settings/data" className="sr-link">
            資料地圖：看看這個空間存了什麼、怎麼刪 →
          </Link>
        </p>
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-3)' }}>空間</h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--sr-space-2) var(--sr-space-6)',
            margin: 0,
          }}
        >
          <dt className="sr-muted">名稱</dt>
          <dd style={{ margin: 0 }}>{space.name}</dd>
          <dt className="sr-muted">識別碼</dt>
          <dd style={{ margin: 0, fontFamily: 'var(--sr-font-mono)' }}>{space.slug}</dd>
          <dt className="sr-muted">時區</dt>
          <dd style={{ margin: 0 }}>{space.timezone}</dd>
        </dl>
      </section>
    </div>
  )
}
