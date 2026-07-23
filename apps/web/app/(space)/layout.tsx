import Link from 'next/link'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { getFlags } from '@/lib/flags'
import {
  compileThemeToCssText,
  themeDataAttributes,
  themeDefinitionSchema,
  defaultThemeDefinition,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'
import { resolveCurrentBackground } from '@/lib/api/background-resolver'
import { BackgroundLayer, type BackgroundState } from '@/components/BackgroundLayer'
import { signOut } from '../(auth)/actions'

/**
 * Space Shell。
 *
 * 導覽只顯示「這個 Milestone 真的做得到的事」。
 * Q6（無假按鈕）：尚未實作的區域不出現在導覽中。
 */
export default async function SpaceLayout({ children }: { children: React.ReactNode }) {
  const { space, role } = await requireActiveSpace()
  const flags = await getFlags(space.id)
  const db = await getDb()

  // ── 套用中的主題 ──
  let definition: ThemeDefinition = defaultThemeDefinition()
  if (space.id) {
    const { data: spaceRow } = await db
      .from('spaces')
      .select('active_theme_id')
      .eq('id', space.id)
      .maybeSingle()

    if (spaceRow?.active_theme_id) {
      const { data: theme } = await db
        .from('themes')
        .select('definition')
        .eq('id', spaceRow.active_theme_id)
        .is('deleted_at', null)
        .maybeSingle()

      const parsed = themeDefinitionSchema.safeParse(theme?.definition)
      // 格式不合時退回預設，而不是讓頁面沒有樣式
      if (parsed.success) definition = parsed.data
      else if (theme) console.warn('[shell] 套用中的主題格式不合，改用預設')
    }
  }

  /*
   * SSR 時就把主題寫進 <style>，避免首屏閃一下預設色再換成使用者的主題。
   * 之後的切換由 applyThemeToDom 直接改 :root 的 style（不經過 React）。
   */
  const themeCss = compileThemeToCssText(definition, ':root')
  const dataAttrs = themeDataAttributes(definition)

  // 背景：SSR 就解析好，避免進頁後才閃一下
  const background = (await resolveCurrentBackground(
    db,
    space.id,
    space.timezone,
  )) as BackgroundState | null

  const nav = [
    { href: '/home', label: 'Home' },
    { href: '/studio/theme', label: 'Theme' },
    { href: '/studio/background', label: 'Background' },
    { href: '/library', label: 'Library' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <div className="sr-shell" {...dataAttrs}>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

      <BackgroundLayer spaceId={space.id} state={background} />

      <header className="sr-nav">
        <strong style={{ fontSize: 'var(--sr-text-lg)' }}>{space.name}</strong>

        <nav aria-label="主導覽" className="sr-nav-links">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sr-nav-end">
          <span className="sr-muted">{role === 'owner' ? '擁有者' : role}</span>
          <form action={signOut}>
            <button className="sr-button sr-button-secondary" type="submit">
              登出
            </button>
          </form>
        </div>
      </header>

      <main className="sr-main">{children}</main>

      {process.env.NODE_ENV === 'development' && (
        <footer className="sr-main" style={{ paddingTop: 0 }}>
          <p className="sr-muted">
            Flags：
            {Object.entries(flags)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join('、') || '全部關閉'}
          </p>
        </footer>
      )}
    </div>
  )
}
