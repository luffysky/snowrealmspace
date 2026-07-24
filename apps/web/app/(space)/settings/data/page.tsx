import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { DangerZone } from '../DangerZone'

export const metadata: Metadata = { title: '資料地圖 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * 資料地圖（v1.0 §32.4 隱私）：這個空間存了哪些資料、在哪裡、怎麼刪。
 * 誠實面對「我們留了什麼」是這個產品的原則之一。
 */
async function countOf(
  db: Awaited<ReturnType<typeof getDb>>,
  table:
    | 'assets'
    | 'projects'
    | 'design_files'
    | 'themes'
    | 'background_items'
    | 'timeline_events'
    | 'insights'
    | 'notifications',
  spaceId: string,
): Promise<number> {
  const { count } = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .is('deleted_at', null)
  return count ?? 0
}

export default async function DataMapPage() {
  const { space } = await requireActiveSpace()
  const user = await getUser()
  const db = await getDb()

  const [assets, projects, works, themes, backgrounds, timeline, insights, notifications] =
    await Promise.all([
      countOf(db, 'assets', space.id),
      countOf(db, 'projects', space.id),
      countOf(db, 'design_files', space.id),
      countOf(db, 'themes', space.id),
      countOf(db, 'background_items', space.id),
      countOf(db, 'timeline_events', space.id),
      countOf(db, 'insights', space.id),
      countOf(db, 'notifications', space.id),
    ])

  const { data: storage } = await db.rpc('space_storage_bytes', { target_space_id: space.id })
  const usedMb = typeof storage === 'number' ? Math.round((storage / 1024 / 1024) * 10) / 10 : null

  const rows: { label: string; count: number; where: string; href: string; how: string }[] = [
    { label: '檔案（圖片／影片／PDF）', count: assets, where: 'R2 儲存 + assets 表', href: '/library', how: '在 Library 逐一刪除（含引用檢查、30 天寬限）' },
    { label: '專案', count: projects, where: 'projects 表', href: '/projects', how: '在 Projects 刪除（作品保留、僅解除歸屬）' },
    { label: '作品與版本', count: works, where: 'design_files / design_snapshots', href: '/works', how: '在 Works 刪除作品或個別版本' },
    { label: '主題', count: themes, where: 'themes 表', href: '/studio/theme', how: '在 Theme Studio 刪除' },
    { label: '背景', count: backgrounds, where: 'background_items 表', href: '/studio/background', how: '在 Background Studio 刪除' },
    { label: '時間軸', count: timeline, where: 'timeline_events 表', href: '/timeline', how: '在 Timeline 隱藏或刪除每一筆' },
    { label: '回顧 Insight', count: insights, where: 'insights 表', href: '/insights', how: '在 Insight 頁刪除' },
    { label: '通知', count: notifications, where: 'notifications 表', href: '/home', how: '在鈴鐺面板管理' },
  ]

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>資料地圖</h1>
        <p className="sr-muted">
          這個空間目前存了哪些東西、放在哪裡、怎麼刪。我們不藏 —— 你隨時能把任何一項帶走或清掉。
        </p>
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">儲存用量</h2>
        <p className="sr-muted">
          {usedMb === null ? '尚未計算' : `已使用約 ${usedMb} MB / 5 GB（每個空間上限）`}
        </p>
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">資料清單</h2>
        <ul className="sr-datamap">
          {rows.map((r) => (
            <li key={r.label} className="sr-datamap-row">
              <div>
                <strong>{r.label}</strong>
                <span className="sr-badge">{r.count}</span>
              </div>
              <p className="sr-muted">存於 {r.where}。{r.how}。</p>
              <Link href={r.href} className="sr-link">
                前往管理 →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">匯出我的資料</h2>
        <p className="sr-muted" style={{ marginTop: 0 }}>
          把這個空間的資料與設定（主題、背景、專案、作品、時間軸、記憶、回顧、通知、檔案清單…）
          下載成一份可讀、可再匯入的 JSON。檔案本身的位元組不在裡面，可到 Library 逐一下載。
        </p>
        <p style={{ margin: 0 }}>
          <a href="/api/account/export" className="sr-button sr-button-secondary" download>
            下載 JSON 匯出
          </a>
        </p>
      </section>

      <DangerZone spaceId={space.id} spaceName={space.name} userEmail={user?.email ?? null} />
    </div>
  )
}
