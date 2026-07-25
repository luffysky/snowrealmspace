'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 隨手記。
 *
 * 存到 DB（widget_notes 表，走 RLS）—— 跨裝置可見。
 * 自動存檔用防抖：停止輸入 autoSaveSeconds 秒後才送出 PUT。
 *
 * **狀態要誠實**（CLAUDE.md：靜默失敗是 bug）：載入中／儲存中／已同步／失敗
 * 都明白顯示，失敗用 danger 色，不假裝已存。
 */

type SaveState = 'loading' | 'idle' | 'saving' | 'saved' | 'load-error' | 'save-error'

export default function QuickNoteWidget({ instanceId, config }: WidgetProps) {
  const placeholder = (config as { placeholder?: string } | null)?.placeholder ?? '隨手記下…'
  const autoSaveSeconds = (config as { autoSaveSeconds?: number } | null)?.autoSaveSeconds ?? 3

  const [text, setText] = useState('')
  const [state, setState] = useState<SaveState>('loading')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  // 首載：從雲端讀回。
  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/widgets/${instanceId}/note`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { data?: { body?: string } }) => {
        if (!alive) return
        setText(json.data?.body ?? '')
        loaded.current = true
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('load-error')
      })
    return () => {
      alive = false
    }
  }, [instanceId])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const save = useCallback(
    async (value: string) => {
      setState('saving')
      try {
        const res = await fetch(`/api/widgets/${instanceId}/note`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: value }),
        })
        if (!res.ok) throw new Error(String(res.status))
        setState('saved')
      } catch {
        setState('save-error')
      }
    },
    [instanceId],
  )

  function onChange(value: string) {
    setText(value)
    if (!loaded.current) return // 還沒載回前不覆寫雲端
    setState('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(value), autoSaveSeconds * 1000)
  }

  const hint =
    state === 'loading'
      ? '載入中…'
      : state === 'saving'
        ? '儲存中…'
        : state === 'saved'
          ? '已同步到雲端。'
          : state === 'load-error'
            ? '讀不到雲端內容，請重新整理頁面再試。'
            : state === 'save-error'
              ? '儲存失敗，請稍後再試。'
              : '會自動存到雲端，換裝置也看得到。'

  const isError = state === 'load-error' || state === 'save-error'

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">隨手記</h3>

      <label className="sr-visually-hidden" htmlFor={`note-${instanceId}`}>
        筆記內容
      </label>
      <textarea
        id={`note-${instanceId}`}
        className="sr-input sr-widget-note"
        value={text}
        placeholder={placeholder}
        // 載入失敗時鎖住，避免用未載入的空內容覆寫雲端
        disabled={state === 'loading' || state === 'load-error'}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`note-hint-${instanceId}`}
      />

      <p
        className="sr-muted"
        id={`note-hint-${instanceId}`}
        style={{ marginBottom: 0, ...(isError ? { color: 'var(--sr-danger)' } : {}) }}
      >
        {hint}
      </p>
    </div>
  )
}
