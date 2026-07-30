'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/** 目標追蹤：新增／推進（±1）／完成／刪除。存到 goals（走 RLS）。 */

type Cfg = { showCompleted?: boolean }
type Goal = {
  id: string
  title: string
  target: number
  current: number
  unit: string
  done: boolean
}
type State = 'loading' | 'idle' | 'load-error'

export default function GoalTrackerWidget({ spaceId, config }: WidgetProps) {
  const showCompleted = (config as Cfg | null)?.showCompleted ?? false
  const [state, setState] = useState<State>('loading')
  const [goals, setGoals] = useState<Goal[]>([])
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('1')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/goals', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: Goal[] }) => {
        if (!alive) return
        setGoals(b.data)
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('load-error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  async function addGoal() {
    const t = title.trim()
    const n = Math.max(1, parseInt(target, 10) || 1)
    if (!t || adding) return
    setAdding(true)
    setErr(null)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ title: t, target: n, unit: unit.trim() }),
      })
      if (!res.ok) throw new Error()
      const body = (await res.json()) as { data: Goal }
      setGoals((prev) => [body.data, ...prev])
      setTitle('')
      setTarget('1')
      setUnit('')
    } catch {
      setErr('新增失敗，請再試一次。')
    } finally {
      setAdding(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...body } as Goal : g)),
    )
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const updated = (await res.json()) as { data: Goal }
      setGoals((prev) => prev.map((g) => (g.id === id ? updated.data : g)))
    } catch {
      setErr('更新失敗，請重新整理。')
    }
  }

  async function bump(g: Goal, delta: number) {
    const next = Math.min(g.target, Math.max(0, g.current + delta))
    await patch(g.id, { current: next, done: next >= g.target })
  }

  async function remove(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE', headers: { 'x-space-id': spaceId } })
    } catch {
      /* 已從 UI 移除；後端刪除失敗下次載入會再出現 */
    }
  }

  const visible = showCompleted ? goals : goals.filter((g) => !g.done)

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">目標追蹤</h3>

      {state === 'load-error' ? (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: 0 }}>
          載入不到目標，請重新整理。
        </p>
      ) : (
        <>
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
            {visible.map((g) => {
              const pct = Math.round((g.current / g.target) * 100)
              return (
                <li key={g.id}>
                  <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ textDecoration: g.done ? 'line-through' : 'none' }}>
                      {g.done ? '✓ ' : ''}
                      {g.title}
                    </span>
                    <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                      {g.current}/{g.target}
                      {g.unit ? ` ${g.unit}` : ''}
                    </span>
                  </div>
                  <progress className="sr-progress" max={100} value={pct} style={{ width: '100%' }}>
                    {pct}%
                  </progress>
                  <div className="sr-row" style={{ gap: '4px', marginTop: '2px' }}>
                    <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 8px' }} onClick={() => void bump(g, -1)} disabled={g.current <= 0} aria-label="減一">
                      −
                    </button>
                    <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 8px' }} onClick={() => void bump(g, 1)} disabled={g.current >= g.target} aria-label="加一">
                      ＋
                    </button>
                    <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 8px', marginLeft: 'auto' }} onClick={() => void remove(g.id)} aria-label={`刪除 ${g.title}`}>
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
            {visible.length === 0 && state === 'idle' && (
              <li className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>還沒有目標，先加一個吧。</li>
            )}
          </ul>

          <div className="sr-row" style={{ gap: '4px', marginTop: 'var(--sr-space-2)' }}>
            <input
              className="sr-input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="新目標…"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addGoal()
              }}
            />
            <input
              className="sr-input"
              style={{ width: 56 }}
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="目標數量"
            />
            <input
              className="sr-input"
              style={{ width: 60 }}
              placeholder="單位"
              value={unit}
              maxLength={20}
              onChange={(e) => setUnit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addGoal()
              }}
              aria-label="單位（例如 次、頁、公里）"
            />
            <button type="button" className="sr-button" onClick={() => void addGoal()} disabled={adding || !title.trim()}>
              加
            </button>
          </div>
          {err && (
            <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: '4px 0 0' }}>
              {err}
            </p>
          )}
        </>
      )}
    </div>
  )
}
