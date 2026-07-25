import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { AdminShell, type AdminNavGroup } from './AdminShell'

export const dynamic = 'force-dynamic'

/**
 * 後台外殼：整層先過 checkSiteAdmin（防禦深度，各頁另有自己的閘門）。
 * 側邊欄分組導覽 + 回前台。連結一律吃 ADMIN_BASE（可能含隨機碼）。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}` : '/home')

  const groups: AdminNavGroup[] = [
    {
      group: '總覽',
      items: [
        { href: ADMIN_BASE, label: 'Dashboard' },
        { href: `${ADMIN_BASE}/resources`, label: '資源與成本' },
      ],
    },
    {
      group: 'AI',
      items: [
        { href: `${ADMIN_BASE}/ai-keys`, label: 'AI 金鑰' },
        { href: `${ADMIN_BASE}/ai/models`, label: 'AI 模型' },
        { href: `${ADMIN_BASE}/ai/candidates`, label: '候選鏈' },
        { href: `${ADMIN_BASE}/ai/usage`, label: 'AI 用量與成本' },
        { href: `${ADMIN_BASE}/ai/quota`, label: '每日額度' },
        { href: `${ADMIN_BASE}/ai/cache`, label: '回應快取' },
      ],
    },
    {
      group: 'Agent 與內容',
      items: [
        { href: `${ADMIN_BASE}/agent-actions`, label: 'Agent 動作' },
        { href: `${ADMIN_BASE}/content`, label: '內容池' },
        { href: `${ADMIN_BASE}/content-filters`, label: '內容安全字樣' },
        { href: `${ADMIN_BASE}/flags`, label: 'Feature Flags' },
      ],
    },
    {
      group: '系統與稽核',
      items: [
        { href: `${ADMIN_BASE}/users`, label: '使用者管理' },
        { href: `${ADMIN_BASE}/spaces`, label: 'Space／使用者' },
        { href: `${ADMIN_BASE}/system`, label: '系統健康' },
        { href: `${ADMIN_BASE}/audit`, label: '稽核日誌' },
      ],
    },
  ]

  return (
    <AdminShell groups={groups} homeHref="/home">
      {children}
    </AdminShell>
  )
}
