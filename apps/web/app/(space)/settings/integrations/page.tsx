import type { Metadata } from 'next'
import Link from 'next/link'
import { ALL_PROVIDERS } from '@snowrealm/provider-core'
import { requireActiveSpace, requireUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { getFlags } from '@/lib/flags'
import { PROVIDER_FLAG, PROVIDER_LABEL, isConnectable, isProviderKey, type ProviderKey } from '@/lib/integrations/providers'
import { IntegrationsClient } from './IntegrationsClient'

export const metadata: Metadata = { title: '外部設計工具 — SnowRealm-Space' }
export const dynamic = 'force-dynamic'

const ERROR_MESSAGE: Record<string, string> = {
  denied: '你在 provider 授權頁取消了。',
  missing_code: '授權流程中斷（沒有拿到 code），請再試一次。',
  state_lost: '找不到這次授權的暫存（可能逾時，或不是同一個瀏覽器）。請重新連接。',
  expired: '這次授權已逾時（超過 10 分鐘）。請重新連接。',
  state_mismatch: '授權驗證不相符，請重新連接。',
  session_mismatch: '登入身分與發起連接的人不符，沒有完成連接。',
  not_configured: '這個 provider 的憑證尚未在伺服器設定。',
  exchange_failed: '向 provider 換取授權失敗，請再試一次。',
  no_encryption_key: '伺服器缺少加密金鑰，無法安全保存 token。',
  save_failed: '儲存連線時發生問題，請再試一次。',
  unknown_provider: '未知的 provider。',
}

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUser()
  const { space, role } = await requireActiveSpace()
  const params = await searchParams
  const flags = await getFlags(space.id)

  const db = await getDb()
  const { data: conns } = await db
    .from('design_connections')
    .select('id, provider, status, last_synced_at, last_error, external_account_label, created_at')
    .eq('space_id', space.id)
    .order('created_at', { ascending: true })

  const items = ALL_PROVIDERS.filter((c) => isProviderKey(c.provider))
    .filter((c) => flags[PROVIDER_FLAG[c.provider as ProviderKey]])
    .map((c) => {
      const provider = c.provider as ProviderKey
      // 同 provider 可能有多個帳號 → 全帶進去（依連接先後排序），前端每個帳號各一列。
      const connections = (conns ?? [])
        .filter((x) => x.provider === provider)
        .map((x) => ({
          id: x.id,
          status: x.status,
          lastSyncedAt: x.last_synced_at,
          lastError: x.last_error,
          accountLabel: x.external_account_label,
        }))
      return {
        provider,
        label: PROVIDER_LABEL[provider],
        connectable: isConnectable(provider),
        connections,
      }
    })

  const connectedKey = typeof params['connected'] === 'string' ? params['connected'] : null
  const errorKey = typeof params['error'] === 'string' ? params['error'] : null

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/settings" className="sr-link">
          ← 設定
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>外部設計工具</h1>
      <p className="sr-muted">
        連接 Figma、Canva 或 Adobe，把設計檔帶進這個空間、追蹤版本。授權以加密方式保存，永不外流；隨時可中斷。
      </p>

      {connectedKey && (
        <p
          className="sr-card"
          role="status"
          style={{ marginTop: 'var(--sr-space-4)', borderColor: 'var(--sr-accent)' }}
        >
          已連接 {PROVIDER_LABEL[connectedKey as ProviderKey] ?? connectedKey}。
        </p>
      )}
      {errorKey && (
        <p
          className="sr-card"
          role="alert"
          style={{ marginTop: 'var(--sr-space-4)', color: 'var(--sr-danger)', borderColor: 'var(--sr-danger)' }}
        >
          {ERROR_MESSAGE[errorKey] ?? '連接時發生問題，請再試一次。'}
        </p>
      )}

      {role !== 'owner' && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }}>
          只有空間擁有者能連接或中斷外部工具。
        </p>
      )}

      {items.length === 0 ? (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }}>
          目前沒有已啟用的整合。啟用後（管理後台 Feature Flags）會出現在這裡。
        </p>
      ) : (
        <IntegrationsClient items={items} isOwner={role === 'owner'} />
      )}
    </main>
  )
}
