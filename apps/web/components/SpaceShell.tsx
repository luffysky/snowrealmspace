'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { startTutorial } from '@/components/tutorial/TutorialController'

/**
 * Space Shell 的互動外殼。
 *
 * 兩種形態，用 CSS 斷點切換，狀態在這裡集中管理：
 *   - 桌機／筆電（≥1024px）：左側 **可收合側邊欄**。展開顯示圖示＋文字，
 *     收合成純圖示軌道；收合狀態記在 localStorage。內容區隨欄寬過渡。
 *   - 手機／平板（<1024px）：頂列 **漢堡選單**，側邊欄變成從左滑入的抽屜，
 *     連結逐項「時間差」淡入。點連結或背景遮罩即關閉。
 *
 * 之前是一整排 flex-wrap 連結，窄螢幕會換好幾行、把 header 撐寬 → 行動瀏覽器縮放整頁
 * （見 CLAUDE.md 踩坑 #5）。改成這個結構後 header 高度固定、不再溢位。
 *
 * server 端的控制項（音樂／通知鈴／深淺切換／登出 form）與頁尾以 props 傳入，
 * 原封不動渲染 —— 保留它們的 server action 與 data-tour 錨點。
 */

export type NavItem = { href: string; label: string }

/** 每個導覽項目的圖示（收合軌道只剩圖示時要能辨識）。純幾何 stroke，用 currentColor。 */
const ICONS: Record<string, React.ReactNode> = {
  '/home': (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  '/studio/theme': <path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10Z" />,
  '/studio/background': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </>
  ),
  '/library': (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  '/projects': <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  '/works': <path d="M12 3l2.2 5.5L20 10l-5.8 1.5L12 17l-2.2-5.5L4 10l5.8-1.5Z" />,
  '/timeline': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  '/daily': (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18M8 14h3" />
    </>
  ),
  '/surprises': (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1.5" />
      <path d="M3 12h18M12 8v13" />
      <path d="M12 8S9.5 3.5 7.5 5.5 10.5 8 12 8Zm0 0s2.5-4.5 4.5-2.5S13.5 8 12 8Z" />
    </>
  ),
  '/principles': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 4-4 2 2-4Z" />
    </>
  ),
  '/agent': <path d="M4 5h16v11H8l-4 3Z" />,
  '/settings': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
    </>
  ),
}

function NavIcon({ href }: { href: string }) {
  return (
    <svg
      className="sr-nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[href] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}

const COLLAPSE_KEY = 'sr:sidebar-collapsed'

export function SpaceShell({
  spaceName,
  roleLabel,
  nav,
  adminHref,
  actions,
  footer,
  children,
}: {
  spaceName: string
  roleLabel: string
  nav: NavItem[]
  adminHref?: string | null
  actions: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ready, setReady] = useState(false)

  // 桌機收合狀態記在 localStorage（換頁保留）。ready 之前不套過渡，避免首載閃動。
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    setReady(true)
  }, [])

  // 換頁自動收起手機抽屜。
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // 抽屜開啟時鎖背景捲動（position:fixed，手機才真的鎖得住）。
  useScrollLock(mobileOpen)
  // Esc 關閉。
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div
      className="sr-shell"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-open={mobileOpen ? 'true' : 'false'}
      data-ready={ready ? 'true' : 'false'}
    >
      <header className="sr-topbar">
        <button
          type="button"
          className="sr-icon-btn sr-hamburger"
          aria-label={mobileOpen ? '關閉選單' : '開啟選單'}
          aria-expanded={mobileOpen}
          aria-controls="sr-sidebar"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        <button
          type="button"
          className="sr-icon-btn sr-collapse-toggle"
          aria-label={collapsed ? '展開側邊欄' : '收合側邊欄'}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>

        <strong className="sr-brand">{spaceName}</strong>

        <div className="sr-actions">{actions}</div>
      </header>

      <aside id="sr-sidebar" className="sr-sidebar" data-tour="nav">
        <nav aria-label="主導覽" className="sr-sidebar-nav">
          {nav.map((item, i) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sr-nav-link"
                aria-current={active ? 'page' : undefined}
                title={item.label}
                style={{ '--i': i } as React.CSSProperties}
              >
                <NavIcon href={item.href} />
                <span className="sr-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        {adminHref && (
          <Link href={adminHref} className="sr-nav-link sr-nav-admin" title="網站後台">
            <svg
              className="sr-nav-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="sr-nav-label">網站後台</span>
          </Link>
        )}
        <div className="sr-sidebar-secondary">
          <Link href="/guide" className="sr-nav-sub" title="使用說明">
            使用說明
          </Link>
          <button
            type="button"
            className="sr-nav-sub"
            onClick={() => startTutorial('home')}
            title="重新看一次互動教學"
          >
            ▶ 互動教學
          </button>
          <Link href="/privacy" className="sr-nav-sub" title="隱私政策">
            隱私政策
          </Link>
          <Link href="/terms" className="sr-nav-sub" title="使用條款">
            使用條款
          </Link>
        </div>

        <p className="sr-sidebar-role sr-muted">{roleLabel}</p>
      </aside>

      {/* 手機抽屜背景遮罩 */}
      <button
        type="button"
        className="sr-scrim"
        aria-label="關閉選單"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <div className="sr-content">
        <main className="sr-main">{children}</main>
        {footer}
      </div>
    </div>
  )
}
