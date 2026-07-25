'use client'

import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 專注計時（番茄鐘）。純前端計時，不落地——計時狀態本來就是短暫的。
 * 工作階段結束 → 休息；休息結束 → 下一輪工作，直到跑完設定的輪數。
 */

type Cfg = { workMinutes?: number; breakMinutes?: number; rounds?: number }
type Phase = 'idle' | 'work' | 'break' | 'done'

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FocusTimerWidget({ config }: WidgetProps) {
  const cfg = (config ?? {}) as Cfg
  const workSec = (cfg.workMinutes ?? 25) * 60
  const breakSec = (cfg.breakMinutes ?? 5) * 60
  const totalRounds = cfg.rounds ?? 4

  const [phase, setPhase] = useState<Phase>('idle')
  const [left, setLeft] = useState(workSec)
  const [round, setRound] = useState(1)
  const [running, setRunning] = useState(false)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    tick.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => {
      if (tick.current) clearInterval(tick.current)
    }
  }, [running])

  // 到 0 → 換階段
  useEffect(() => {
    if (left > 0 || phase === 'idle' || phase === 'done') return
    if (phase === 'work') {
      setPhase('break')
      setLeft(breakSec)
    } else if (phase === 'break') {
      if (round >= totalRounds) {
        setPhase('done')
        setRunning(false)
      } else {
        setRound((r) => r + 1)
        setPhase('work')
        setLeft(workSec)
      }
    }
  }, [left, phase, round, totalRounds, workSec, breakSec])

  function start() {
    if (phase === 'idle' || phase === 'done') {
      setPhase('work')
      setLeft(workSec)
      setRound(1)
    }
    setRunning(true)
  }
  function reset() {
    setRunning(false)
    setPhase('idle')
    setLeft(workSec)
    setRound(1)
  }

  const label =
    phase === 'work' ? '專注' : phase === 'break' ? '休息' : phase === 'done' ? '完成 🎉' : '準備好了嗎'

  return (
    <div className="sr-card sr-widget" style={{ textAlign: 'center' }}>
      <h3 className="sr-widget-title">專注計時</h3>
      <p className="sr-muted" style={{ margin: 0 }}>
        {label}
        {phase !== 'idle' && phase !== 'done' && ` · 第 ${round}/${totalRounds} 輪`}
      </p>
      <div style={{ fontSize: '2.4rem', fontVariantNumeric: 'tabular-nums', margin: 'var(--sr-space-2) 0' }}>
        {fmt(phase === 'idle' ? workSec : left)}
      </div>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', justifyContent: 'center' }}>
        {running ? (
          <button type="button" className="sr-button sr-button-secondary" onClick={() => setRunning(false)}>
            暫停
          </button>
        ) : (
          <button type="button" className="sr-button" onClick={start} disabled={phase === 'done'}>
            {phase === 'idle' || phase === 'done' ? '開始' : '繼續'}
          </button>
        )}
        <button type="button" className="sr-button sr-button-secondary" onClick={reset}>
          重設
        </button>
      </div>
    </div>
  )
}
