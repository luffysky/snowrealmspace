import type { Metadata } from 'next'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { updatePrivacySettings } from './actions'
import { PrivacyToggles } from './PrivacyToggles'

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

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>設定</h1>
        <p className="sr-muted">{user?.email}</p>
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
