import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { ADMIN_BASE } from '@/lib/admin-path'
import { DialogProvider } from '@/components/ui/DialogProvider'
import { AdminShell, type AdminNavGroup } from './AdminShell'
import {
  compileThemeToCssText,
  themeDataAttributes,
  themeDefinitionSchema,
  defaultThemeDefinition,
  effectiveTheme,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'
import { resolveThemeFonts } from '@/lib/theme/server-fonts'
import { MODE_COOKIE, parseMode } from '@/lib/theme/mode'

export const dynamic = 'force-dynamic'

/**
 * 後台外殼：整層先過 checkSiteAdmin（防禦深度，各頁另有自己的閘門）。
 * 側邊欄分組導覽 + 回前台。連結一律吃 ADMIN_BASE（可能含隨機碼）。
 *
 * 後台也套用「管理員自己空間」的主題與字體 —— 否則字體選了、後台卻還是系統預設字體
 * （使用者回報過）。走跟 (space)/layout 同一套：SSR 注入 :root 主題 CSS + @font-face + 預載。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}` : '/home')

  // 管理員自己空間的主題（active_theme_id → themes.definition），拿來套字體/顏色。
  const user = await getUser()
  const db = await getDb()
  let definition: ThemeDefinition = defaultThemeDefinition()
  if (user) {
    const { data: sp } = await db
      .from('spaces')
      .select('active_theme_id')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (sp?.active_theme_id) {
      const { data: theme } = await db
        .from('themes')
        .select('definition')
        .eq('id', sp.active_theme_id)
        .is('deleted_at', null)
        .maybeSingle()
      const parsed = themeDefinitionSchema.safeParse(theme?.definition)
      if (parsed.success) definition = parsed.data
    }
  }
  const mode = parseMode((await cookies()).get(MODE_COOKIE)?.value)
  const effective = effectiveTheme(definition, mode)
  const themeCss = compileThemeToCssText(effective, ':root')
  const dataAttrs = themeDataAttributes(effective)
  const fonts = await resolveThemeFonts(db, definition)

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
        { href: `${ADMIN_BASE}/conversations`, label: '對話紀錄' },
        { href: `${ADMIN_BASE}/agent-actions`, label: 'Agent 動作' },
        { href: `${ADMIN_BASE}/content`, label: '內容池' },
        { href: `${ADMIN_BASE}/content-filters`, label: '內容安全字樣' },
        { href: `${ADMIN_BASE}/flags`, label: 'Feature Flags' },
      ],
    },
    {
      group: '外觀資源',
      items: [{ href: `${ADMIN_BASE}/fonts`, label: '字體管理' }],
    },
    {
      group: '工具',
      items: [{ href: `${ADMIN_BASE}/secrets`, label: 'Secret 產生器' }],
    },
    {
      group: '系統與稽核',
      items: [
        { href: `${ADMIN_BASE}/users`, label: '使用者管理' },
        { href: `${ADMIN_BASE}/spaces`, label: 'Space／使用者' },
        { href: `${ADMIN_BASE}/integrations`, label: '整合狀態' },
        { href: `${ADMIN_BASE}/system`, label: '系統健康' },
        { href: `${ADMIN_BASE}/audit`, label: '稽核日誌' },
      ],
    },
  ]

  return (
    <div data-color-mode={mode} {...dataAttrs}>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      {fonts && (
        <>
          <style dangerouslySetInnerHTML={{ __html: fonts.css }} />
          {fonts.preload.map((href) => (
            <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="" />
          ))}
        </>
      )}
      <DialogProvider>
        <AdminShell groups={groups} homeHref="/home">
          {children}
        </AdminShell>
      </DialogProvider>
    </div>
  )
}
