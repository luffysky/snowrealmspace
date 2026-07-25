'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useScrollLock } from '@/lib/use-scroll-lock'

export type AdminNavGroup = { group: string; items: { href: string; label: string }[] }

/**
 * 後台外殼：左側邊欄（分組導覽）＋ 頂列（品牌 + 回前台）＋ 手機抽屜。
 * 重用 space shell 的 CSS（.sr-shell / .sr-sidebar / .sr-topbar…），視覺一致。
 * 後台不做收合軌道（純文字連結），只做「桌機固定側邊欄 / 手機漢堡抽屜」。
 */
export function AdminShell({
  groups,
  homeHref,
  children,
}: {
  groups: AdminNavGroup[]
  homeHref: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleGroup(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  useEffect(() => setReady(true), [])
  useEffect(() => setMobileOpen(false), [pathname])
  useScrollLock(mobileOpen)
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function isActive(href: string) {
    return pathname === href
  }

  let i = 0

  return (
    <div className="sr-shell sr-shell-admin" data-open={mobileOpen ? 'true' : 'false'} data-ready={ready ? 'true' : 'false'}>
      <header className="sr-topbar">
        <button
          type="button"
          className="sr-icon-btn sr-hamburger"
          aria-label={mobileOpen ? '關閉選單' : '開啟選單'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <strong className="sr-brand">管理後台</strong>
        <div className="sr-actions">
          <Link href={homeHref} className="sr-button sr-button-secondary">
            ← 回前台
          </Link>
        </div>
      </header>

      <aside id="sr-admin-sidebar" className="sr-sidebar">
        <nav aria-label="後台導覽" className="sr-sidebar-nav">
          {groups.map((g) => {
            const groupCollapsed = collapsed.has(g.group)
            const hasActive = g.items.some((it) => isActive(it.href))
            return (
              <div key={g.group} className="sr-admin-navgroup">
                <button
                  type="button"
                  className="sr-admin-navgroup-title"
                  aria-expanded={!groupCollapsed}
                  onClick={() => toggleGroup(g.group)}
                >
                  <span>{g.group}</span>
                  <svg
                    className="sr-admin-chevron"
                    data-collapsed={groupCollapsed ? 'true' : 'false'}
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {!groupCollapsed &&
                  g.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="sr-nav-link sr-admin-navlink"
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      style={{ '--i': i++ } as React.CSSProperties}
                    >
                      <span className="sr-nav-label">{item.label}</span>
                    </Link>
                  ))}
                {groupCollapsed && hasActive && <span className="sr-admin-navgroup-dot" aria-hidden="true" />}
              </div>
            )
          })}
        </nav>
      </aside>

      <button type="button" className="sr-scrim" aria-label="關閉選單" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)} />

      {/* 各後台頁自帶 <main>，這裡只提供 grid 內容區 */}
      <div className="sr-content">{children}</div>
    </div>
  )
}
