'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Notification = {
  id: string
  category: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

const CATEGORY_LABEL: Record<string, string> = {
  daily: '每日',
  agent: 'Agent',
  weekly_recap: '回顧',
  milestone: '里程碑',
  processing_done: '處理完成',
  sync_success: '同步',
  sync_failed: '同步失敗',
}

/**
 * 通知鈴鐺（Milestone E）。in-app、分類、已讀、一鍵關閉（連到設定）。
 * Quiet hours 影響的是「主動訊息會不會產生」（後端把關），不是這裡的顯示。
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      const json = (await res.json()) as { data: { items: Notification[]; unread: number } }
      setItems(json.data.items)
      setUnread(json.data.unread)
    } catch {
      /* 靜默：鈴鐺不該讓頁面壞掉 */
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // 點外面關閉
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function markAllRead() {
    setUnread(0)
    setItems((xs) => xs.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    }).catch(() => {})
  }

  async function markOne(id: string) {
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)))
    setUnread((u) => Math.max(0, u - 1))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read', id }),
    }).catch(() => {})
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="sr-button sr-button-secondary sr-icon-button"
        aria-label={unread > 0 ? `通知（${unread} 則未讀）` : '通知'}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unread > 0 && <span className="sr-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="sr-notif-panel" role="dialog" aria-label="通知">
          <header className="sr-notif-head">
            <strong>通知</strong>
            <div className="sr-row" style={{ gap: 'var(--sr-space-2)' }}>
              {unread > 0 && (
                <button type="button" className="sr-linkish" onClick={markAllRead}>
                  全部已讀
                </button>
              )}
              <Link href="/settings" className="sr-linkish" onClick={() => setOpen(false)}>
                關閉通知
              </Link>
            </div>
          </header>

          {items.length === 0 ? (
            <p className="sr-muted" style={{ padding: 'var(--sr-space-4)', margin: 0 }}>
              目前沒有通知。
            </p>
          ) : (
            <ul className="sr-notif-list">
              {items.map((n) => {
                const inner = (
                  <>
                    <span className="sr-notif-cat">{CATEGORY_LABEL[n.category] ?? n.category}</span>
                    <span className="sr-notif-title">{n.title}</span>
                    {n.body && <span className="sr-notif-body">{n.body}</span>}
                  </>
                )
                return (
                  <li key={n.id} className={`sr-notif-item ${n.readAt ? '' : 'sr-notif-unread'}`}>
                    {n.link ? (
                      <Link href={n.link} className="sr-notif-link" onClick={() => void markOne(n.id)}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" className="sr-notif-link" onClick={() => void markOne(n.id)}>
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
