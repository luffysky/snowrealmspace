'use client'

import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 待辦清單：勾選 / 新增 / 刪除，狀態存回這個 widget 自己的 config。
 *
 * 為什麼存回 config：這是純瀏覽器小工具，沒有專屬資料表。狀態量小、
 * 只屬於這一個 widget 實例，寫回 config 最省事也最一致（跨裝置同步）。
 *
 * 寫回時 **合併** 既有 config（`...config`）—— config 裡還有背景相關的
 * 自由鍵（bg / bgAnimate / bgOpacity），若整包覆寫會把使用者設的背景清掉。
 *
 * 掛載後以本地 state 為真相：先樂觀更新畫面，再 debounce（~500ms）寫回，
 * 連續勾選不會每次都打 API。寫回失敗會顯示一行提示（不靜默失敗，CLAUDE.md）。
 */

type Item = { id: string; text: string; done: boolean }
type Cfg = { title?: string; items?: Item[] }

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function TodoListWidget({ spaceId, instanceId, config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const title = cfg.title || '待辦'

  const [items, setItems] = useState<Item[]>(() => (Array.isArray(cfg.items) ? cfg.items : []))
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  /** debounce 合併寫回：保留 bg/bgAnimate/bgOpacity 等既有鍵，只換 items。 */
  function persist(next: Item[]) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void fetch(`/api/widgets/${instanceId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ config: { ...(config as object), items: next } }),
      })
        .then((r) => {
          if (!r.ok) throw new Error()
          setErr(null)
        })
        .catch(() => setErr('存不了，剛才的變更可能沒同步。'))
    }, 500)
  }

  function commit(next: Item[]) {
    setItems(next)
    persist(next)
  }

  function toggle(id: string) {
    commit(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)))
  }

  function remove(id: string) {
    commit(items.filter((it) => it.id !== id))
  }

  function add() {
    const text = draft.trim()
    if (!text) return
    commit([...items, { id: newId(), text, done: false }])
    setDraft('')
  }

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
        {title}
      </h3>

      <div className="sr-row" style={{ gap: '4px', marginTop: 'var(--sr-space-1)' }}>
        <input
          className="sr-input"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="新增一項…"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className="sr-button"
          style={{ padding: '2px 12px', flexShrink: 0 }}
          onClick={add}
          disabled={!draft.trim()}
          aria-label="新增項目"
        >
          ＋
        </button>
      </div>

      {err && (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: '4px 0 0', fontSize: 'var(--sr-text-sm)' }}>
          {err}
        </p>
      )}

      {items.length === 0 ? (
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0' }}>
          還沒有待辦，想到什麼就加進來吧。
        </p>
      ) : (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: '4px' }}>
          {items.map((it) => (
            <li key={it.id} className="sr-row" style={{ gap: '6px', alignItems: 'center', minWidth: 0 }}>
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => toggle(it.id)}
                aria-label={it.done ? `取消完成：${it.text}` : `標為完成：${it.text}`}
                style={{ flexShrink: 0 }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  fontSize: 'var(--sr-text-sm)',
                  textDecoration: it.done ? 'line-through' : 'none',
                  color: it.done ? 'var(--sr-text-muted)' : 'inherit',
                }}
              >
                {it.text}
              </span>
              <button
                type="button"
                className="sr-button sr-button-secondary"
                style={{ padding: '0 6px', fontSize: 'var(--sr-text-sm)', flexShrink: 0 }}
                onClick={() => remove(it.id)}
                aria-label={`刪除：${it.text}`}
              >
                刪
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
