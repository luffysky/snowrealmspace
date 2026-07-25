import { createAdminClient } from '@snowrealm/db/server'

/**
 * 後台 Dashboard 總覽 KPI。全部從現有真實資料表聚合（無假數字）。
 * 規模是禮物級（少量資料），sum 類直接抓有限筆數在 JS 加總即可。
 */

function fmtBytes(n: number): string {
  if (n <= 0) return '0'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

export async function DashboardStats() {
  const db = createAdminClient()
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 86400000).toISOString()
  const monthAgo = new Date(now - 30 * 86400000).toISOString()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date(now))

  const [
    rUsersTotal,
    rUsersWeek,
    rPrivileged,
    rStaff,
    rSpacesLive,
    rSpacesDeleted,
    rContent,
    rAssetsReady,
    rActivity7d,
    rAiCalls,
    { data: assetBytesRows },
    { data: usageRows },
    { data: quotaRows },
    { data: jobRows },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('privileged', true),
    db.from('profiles').select('*', { count: 'exact', head: true }).in('site_role', ['owner', 'admin']),
    db.from('spaces').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('spaces').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
    db.from('content_items').select('*', { count: 'exact', head: true }),
    db.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'ready').is('deleted_at', null),
    db.from('activity_events').select('*', { count: 'exact', head: true }).gte('occurred_at', weekAgo),
    db.from('ai_usage_log').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
    db.from('assets').select('bytes').eq('status', 'ready').is('deleted_at', null).limit(10000),
    db.from('ai_usage_log').select('cost_usd, is_free').gte('created_at', monthAgo).limit(10000),
    db.from('ai_daily_quota').select('free_calls, paid_calls').eq('local_date', today).limit(2000),
    db.from('job_records').select('status').limit(1000),
  ])

  const usersTotal = rUsersTotal.count ?? 0
  const usersWeek = rUsersWeek.count ?? 0
  const privileged = rPrivileged.count ?? 0
  const staff = rStaff.count ?? 0
  const spacesLive = rSpacesLive.count ?? 0
  const spacesDeleted = rSpacesDeleted.count ?? 0
  const contentTotal = rContent.count ?? 0
  const assetsReady = rAssetsReady.count ?? 0
  const activity7d = rActivity7d.count ?? 0
  const aiCalls30d = rAiCalls.count ?? 0

  const totalBytes = (assetBytesRows ?? []).reduce((s, r) => s + Number(r.bytes ?? 0), 0)
  const aiCost = (usageRows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const aiFree = (usageRows ?? []).filter((r) => r.is_free).length
  const aiPaid = (usageRows ?? []).length - aiFree
  const todayCalls = (quotaRows ?? []).reduce((s, r) => s + Number(r.free_calls ?? 0) + Number(r.paid_calls ?? 0), 0)
  const jobsDone = new Set(['done', 'completed', 'succeeded', 'success'])
  const jobsFailed = (jobRows ?? []).filter((r) => r.status === 'failed' || r.status === 'error').length
  const jobsPending = (jobRows ?? []).filter((r) => !jobsDone.has(r.status) && r.status !== 'failed' && r.status !== 'error').length

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: '使用者', value: String(usersTotal), hint: `本週 +${usersWeek}·管理 ${staff}·特權 ${privileged}` },
    { label: '空間', value: String(spacesLive), hint: spacesDeleted ? `待清除 ${spacesDeleted}` : '皆使用中' },
    { label: '內容池', value: String(contentTotal), hint: '語錄/提示/驚喜' },
    { label: '儲存', value: fmtBytes(totalBytes), hint: `${assetsReady} 個檔案` },
    { label: 'AI 呼叫 (30天)', value: String(aiCalls30d), hint: aiCalls30d ? `免費 ${aiFree}·付費 ${aiPaid}` : '尚無（待金鑰）' },
    { label: 'AI 成本 (30天)', value: `$${aiCost.toFixed(aiCost < 1 ? 4 : 2)}`, hint: '付費模型累計' },
    { label: '今日 AI 呼叫', value: String(todayCalls), hint: 'Asia/Taipei' },
    { label: '佇列', value: String(jobsPending), hint: jobsFailed ? `失敗 ${jobsFailed}` : `近 7 天活動 ${activity7d}` },
  ]

  return (
    <section
      className="sr-stat-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-4)' }}
    >
      {cards.map((c) => (
        <div key={c.label} className="sr-card" style={{ padding: 'var(--sr-space-4)' }}>
          <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
            {c.label}
          </div>
          <div style={{ fontSize: 'var(--sr-text-h2)', fontWeight: 700, lineHeight: 1.2 }}>{c.value}</div>
          {c.hint && (
            <div className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
              {c.hint}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
