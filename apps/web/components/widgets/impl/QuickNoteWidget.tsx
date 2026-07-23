'use client'

import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 隨手記。
 *
 * Milestone B 沒有 notes 表（那是 Milestone C 的 Project System），
 * 所以先存在瀏覽器的 localStorage。
 *
 * **這一點必須讓使用者知道** —— 假裝已經存到雲端，
 * 等他換一台裝置發現東西不見了，比一開始就說清楚糟得多。
 */
export default function QuickNoteWidget({ spaceId, instanceId, config }: WidgetProps) {
  const placeholder = (config as { placeholder?: string } | null)?.placeholder ?? '隨手記下…'
  const autoSaveSeconds = (config as { autoSaveSeconds?: number } | null)?.autoSaveSeconds ?? 5

  const storageKey = `snowrealm:note:${spaceId}:${instanceId}`
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText(window.localStorage.getItem(storageKey) ?? '')
  }, [storageKey])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onChange(value: string) {
    setText(value)
    setSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      window.localStorage.setItem(storageKey, value)
      setSaved(true)
    }, autoSaveSeconds * 1000)
  }

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
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`note-hint-${instanceId}`}
      />

      <p className="sr-muted" id={`note-hint-${instanceId}`} style={{ marginBottom: 0 }}>
        {saved ? '已存在這台裝置。' : '只存在這台裝置，換裝置看不到。'}
      </p>
    </div>
  )
}
