'use client'

import { useEffect, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 骰子決定器：骰子 1–6 / 擲硬幣 / 自訂選項，交給運氣選一個。
 * 純前端，用 Math.random，不落地、不連網。
 *
 * 無障礙：擲的時候有一小段快速跳動的動畫；使用者要求減少動態時直接給結果，不跳動。
 */

type Mode = '骰子 1-6' | '擲硬幣' | '自訂選項'
type Cfg = { mode?: Mode; options?: string }

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function parseOptions(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export default function DiceWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const mode: Mode = cfg.mode ?? '骰子 1-6'
  const options = cfg.options ?? ''
  const reduced = usePrefersReducedMotion()

  const [result, setResult] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const spin = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (spin.current) clearInterval(spin.current)
    },
    [],
  )

  /** 依模式抽一個結果；自訂模式沒有可用選項時回 null。 */
  function pick(): string | null {
    if (mode === '骰子 1-6') {
      return DICE_FACES[Math.floor(Math.random() * 6)] ?? '⚀'
    }
    if (mode === '擲硬幣') {
      return Math.random() < 0.5 ? '正面' : '反面'
    }
    const opts = parseOptions(options)
    if (opts.length === 0) return null
    return opts[Math.floor(Math.random() * opts.length)] ?? null
  }

  function roll() {
    if (mode === '自訂選項' && parseOptions(options).length === 0) {
      setHint('到設定填自訂選項，一行一個。')
      setResult(null)
      return
    }
    setHint(null)

    if (reduced) {
      setResult(pick())
      return
    }

    if (spin.current) clearInterval(spin.current)
    setRolling(true)
    let ticks = 0
    spin.current = setInterval(() => {
      setResult(pick())
      ticks++
      if (ticks >= 8) {
        if (spin.current) clearInterval(spin.current)
        spin.current = null
        setResult(pick())
        setRolling(false)
      }
    }, 60)
  }

  const big = mode === '骰子 1-6'

  return (
    <div className="sr-card sr-widget" style={{ textAlign: 'center' }}>
      <h3 className="sr-widget-title">骰子決定器</h3>

      <div
        style={{
          fontSize: big ? '3rem' : 'var(--sr-text-h1)',
          fontWeight: 700,
          lineHeight: 1.2,
          margin: 'var(--sr-space-2) 0',
          minHeight: '3rem',
          overflowWrap: 'anywhere',
        }}
        aria-live="polite"
      >
        {result ?? (hint ? '—' : '？')}
      </div>

      {hint && (
        <p className="sr-muted" style={{ margin: '0 0 var(--sr-space-2)' }}>
          {hint}
        </p>
      )}

      <button type="button" className="sr-button" onClick={roll} disabled={rolling}>
        {rolling ? '擲…' : '擲一下'}
      </button>
    </div>
  )
}
