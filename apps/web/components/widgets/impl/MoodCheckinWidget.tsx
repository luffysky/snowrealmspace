'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 心情打卡：一天一筆（覆寫）。存到 mood_entries（走 RLS）。
 * 狀態誠實：載入中／存檔中／失敗都明說，不假裝已存。
 */

const MOODS: { key: string; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😄', label: '很好' },
  { key: 'good', emoji: '🙂', label: '不錯' },
  { key: 'ok', emoji: '😐', label: '普通' },
  { key: 'low', emoji: '😔', label: '低落' },
  { key: 'rough', emoji: '😣', label: '很累' },
]
const EMOJI: Record<string, string> = Object.fromEntries(MOODS.map((m) => [m.key, m.emoji]))

type Cfg = { showHistory?: boolean }
type HistoryRow = { local_date: string; mood: string }
type State = 'loading' | 'idle' | 'saving' | 'load-error' | 'save-error'

export default function MoodCheckinWidget({ spaceId, config }: WidgetProps) {
  const showHistory = (config as Cfg | null)?.showHistory ?? true
  const [state, setState] = useState<State>('loading')
  const [mood, setMood] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<HistoryRow[]>([])

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/mood', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { today: { mood: string; note: string } | null; history: HistoryRow[] } }) => {
        if (!alive) return
        setMood(b.data.today?.mood ?? null)
        setNote(b.data.today?.note ?? '')
        setHistory(b.data.history ?? [])
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('load-error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  async function save(nextMood: string, nextNote: string) {
    setState('saving')
    try {
      const res = await fetch('/api/mood', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ mood: nextMood, note: nextNote }),
      })
      if (!res.ok) throw new Error()
      const body = (await res.json()) as { data: { todayDate: string } }
      setMood(nextMood)
      setHistory((prev) => {
        const today = body.data.todayDate
        const rest = prev.filter((h) => h.local_date !== today)
        return [{ local_date: today, mood: nextMood }, ...rest].slice(0, 30)
      })
      setState('idle')
    } catch {
      setState('save-error')
    }
  }

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">心情打卡</h3>
      {state === 'load-error' ? (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: 0 }}>
          讀不到心情紀錄，請重新整理。
        </p>
      ) : (
        <>
          <div className="sr-row" style={{ gap: '4px', flexWrap: 'wrap' }}>
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`sr-button ${mood === m.key ? '' : 'sr-button-secondary'}`}
                style={{ fontSize: '1.3rem', padding: '4px 8px' }}
                aria-pressed={mood === m.key}
                aria-label={m.label}
                title={m.label}
                disabled={state === 'loading' || state === 'saving'}
                onClick={() => void save(m.key, note)}
              >
                {m.emoji}
              </button>
            ))}
          </div>
          <input
            className="sr-input"
            style={{ marginTop: 'var(--sr-space-2)' }}
            placeholder="想記一句嗎？（可留白）"
            value={note}
            maxLength={280}
            disabled={state === 'loading'}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => mood && note !== '' && void save(mood, note)}
          />
          <p className="sr-muted" style={{ margin: '4px 0 0', ...(state === 'save-error' ? { color: 'var(--sr-danger)' } : {}) }}>
            {state === 'saving' ? '存檔中…' : state === 'save-error' ? '存不了，請再試一次。' : mood ? '今天已打卡，隨時可以改。' : '選一個今天的心情。'}
          </p>
          {showHistory && history.length > 0 && (
            <div className="sr-row" style={{ gap: '2px', marginTop: 'var(--sr-space-2)', flexWrap: 'wrap' }} aria-label="近期心情">
              {history.slice(0, 14).map((h) => (
                <span key={h.local_date} title={h.local_date} style={{ fontSize: '1rem' }}>
                  {EMOJI[h.mood] ?? '·'}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
