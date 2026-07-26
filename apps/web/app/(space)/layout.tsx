import { cookies } from 'next/headers'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { getFlags } from '@/lib/flags'
import { accountHasRecovery } from '@/lib/auth/recovery'
import { BindingReminder } from '@/components/BindingReminder'
import { ThemeModeToggle } from '@/components/ThemeModeToggle'
import { NotificationBell } from '@/components/NotificationBell'
import { SiteFooter } from '@/components/SiteFooter'
import { BackgroundMusic } from '@/components/BackgroundMusic'
import { MODE_COOKIE, parseMode } from '@/lib/theme/mode'
import {
  compileThemeToCssText,
  themeDataAttributes,
  themeDefinitionSchema,
  defaultThemeDefinition,
  effectiveTheme,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'
import { resolveThemeFonts } from '@/lib/theme/server-fonts'
import { resolveCurrentBackground } from '@/lib/api/background-resolver'
import { BackgroundLayer, type BackgroundState } from '@/components/BackgroundLayer'
import { SpaceShell } from '@/components/SpaceShell'
import { DialogProvider } from '@/components/ui/DialogProvider'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
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

  // 站台角色（owner/admin）才看得到後台入口
  const siteAdmin = await checkSiteAdmin()
  const adminHref = siteAdmin.ok ? ADMIN_BASE : null
  // 平台擁有者（luffysky00，env/DB 站台 owner）才標「擁有者」；
  // 其他 space 的擁有者（例如 nami0724 收到的空間）標「管理員」。
  const isSiteOwner = siteAdmin.ok && siteAdmin.role === 'owner'

  // 沒有救援方式的帳號才提醒綁定（綁了就不再出現）
  const user = await getUser()
  const needsRecovery = user ? !(await accountHasRecovery(user.id, user.email)) : false

  // 背景音樂設定（Luffy 追加）
  const { data: audioSettings } = await db
    .from('space_settings')
    .select('background_audio_enabled, background_audio_asset_id, background_audio_volume')
    .eq('space_id', space.id)
    .maybeSingle()

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
   * 深／淺色模式（選項 A）：任何主題都能切暗色版。
   * 從 cookie 讀模式，SSR 首屏就用對的顏色，不閃。暗色由 deriveDarkTheme 推導
   * （保留主題色相與個性，只翻明暗）。
   */
  const mode = parseMode((await cookies()).get(MODE_COOKIE)?.value)
  // effectiveTheme 會依「使用者選的底是淺是深」自動推導對應模式的版本：
  // 選淺色主題 → 深色模式得中性深底＋主題強調；選深色主題 → 淺色模式得中性亮底。
  const effective = effectiveTheme(definition, mode)

  /*
   * SSR 時就把主題寫進 <style>，避免首屏閃一下預設色再換成使用者的主題。
   * 之後的切換由 applyThemeToDom 直接改 :root 的 style（不經過 React）。
   */
  const themeCss = compileThemeToCssText(effective, ':root')
  const dataAttrs = themeDataAttributes(effective)

  /*
   * 字體同樣在 SSR 解析。客戶端載入的話首屏會先用系統字體畫一次再換，
   * 中文字體與系統字體的字寬差很多，那一下跳動非常明顯。
   * 解析失敗回 null，頁面退回 CSS 檔的預設堆疊（已在 server-fonts 記錄原因）。
   */
  const fonts = await resolveThemeFonts(db, definition)

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
    { href: '/projects', label: 'Projects' },
    { href: '/works', label: 'Works' },
    { href: '/timeline', label: 'Timeline' },
    { href: '/capture', label: '捕捉' },
    { href: '/notes', label: '筆記' },
    { href: '/daily', label: 'Daily' },
    { href: '/surprises', label: '驚喜收藏' },
    { href: '/principles', label: 'Principles' },
    { href: '/agent', label: 'Agent' },
    { href: '/settings', label: 'Settings' },
  ]

  const actions = (
    <>
      <BackgroundMusic
        spaceId={space.id}
        enabled={audioSettings?.background_audio_enabled ?? false}
        assetId={audioSettings?.background_audio_asset_id ?? null}
        volume={audioSettings?.background_audio_volume ?? 0.5}
      />
      <NotificationBell />
      <span data-tour="theme-toggle">
        <ThemeModeToggle initialMode={mode} baseDef={definition} />
      </span>
      <form action={signOut}>
        <button className="sr-button sr-button-secondary" type="submit">
          登出
        </button>
      </form>
    </>
  )

  const footerNode = (
    <>
      <div className="sr-main" style={{ paddingTop: 0 }}>
        <SiteFooter />
      </div>
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
    </>
  )

  return (
    <div className="sr-shell-root" data-color-mode={mode} {...dataAttrs}>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      {fonts && (
        <>
          <style dangerouslySetInnerHTML={{ __html: fonts.css }} />
          {fonts.preload.map((href) => (
            // crossOrigin 不可省：字體一律是 CORS 請求，即使同源。
            // 少了它瀏覽器會預載一份、實際用時再載一份。
            <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="" />
          ))}
        </>
      )}

      <BackgroundLayer spaceId={space.id} state={background} />

      <DialogProvider>
        <SpaceShell
          spaceId={space.id}
          spaceName={space.name}
          canRename={role === 'owner'}
          roleLabel={
            role === 'owner'
              ? isSiteOwner
                ? '擁有者'
                : '管理員'
              : role === 'collaborator'
                ? '協作者'
                : role === 'guest'
                  ? '訪客'
                  : role
          }
          nav={nav}
          adminHref={adminHref}
          actions={actions}
          footer={footerNode}
        >
          {needsRecovery && <BindingReminder />}
          {children}
        </SpaceShell>
      </DialogProvider>
    </div>
  )
}
