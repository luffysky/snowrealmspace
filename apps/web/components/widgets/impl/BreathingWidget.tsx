'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 呼吸練習：一個會隨階段放大／屏息／縮小的圓，循環引導呼吸。
 *
 * 純前端、不連網、不落地 —— 引導動畫本來就是短暫的。圓的顏色用 --sr-accent。
 *
 * 無障礙（WCAG 2.3.3 / prefers-reduced-motion）：使用者要求減少動態時，
 * **不縮放圓**，只更新階段文字與倒數秒數 —— 資訊照樣傳達，但沒有大幅度動畫。
 *
 * SSR/hydration：計時是 client-only 的，故 mounted 前只畫占位。
 */

type Kind = 'in' | 'hold' | 'out'
type Phase = { label: string; kind: Kind; seconds: number }

const IN = (s: number): Phase => ({ label: '吸氣', kind: 'in', seconds: s })
const HOLD = (s: number): Phase => ({ label: '屏息', kind: 'hold', seconds: s })
const OUT = (s: number): Phase => ({ label: '吐氣', kind: 'out', seconds: s })

const PATTERNS: Record<string, Phase[]> = {
  '箱式 4-4-4-4': [IN(4), HOLD(4), OUT(4), HOLD(4)],
  '4-7-8 放鬆': [IN(4), HOLD(7), OUT(8)],
  '深呼吸 5-5': [IN(5), OUT(5)],
}

const BIG = 1
const SMALL = 0.55

/** 目前該階段圓的目標大小：吸→大、吐→小、屏息維持上一個「動」的狀態。 */
function targetScale(phases: Phase[], idx: number): number {
  for (let i = idx; i >= 0; i--) {
    const k = phases[i]?.kind
    if (k === 'in') return BIG
    if (k === 'out') return SMALL
  }
  return SMALL
}

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

export default function BreathingWidget({ config }: WidgetProps) {
  const pattern = (config as { pattern?: string } | null)?.pattern ?? '箱式 4-4-4-4'
  const phases = useMemo(() => PATTERNS[pattern] ?? PATTERNS['箱式 4-4-4-4']!, [pattern])
  const reduced = usePrefersReducedMotion()

  const [mounted, setMounted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(phases[0]?.seconds ?? 4)

  useEffect(() => setMounted(true), [])

  // pattern 變了就從第一階段重來。
  useEffect(() => {
    setIdx(0)
  }, [phases])

  // 每個階段：設定倒數起點，秒表逐秒遞減，時間到就進下一階段（循環）。
  useEffect(() => {
    if (!mounted) return
    const phase = phases[idx]
    if (!phase) return
    setLeft(phase.seconds)
    const advance = setTimeout(() => {
      setIdx((i) => (i + 1) % phases.length)
    }, phase.seconds * 1000)
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => {
      clearTimeout(advance)
      clearInterval(tick)
    }
  }, [mounted, idx, phases])

  if (!mounted) {
    return (
      <div className="sr-card sr-widget" style={{ textAlign: 'center' }}>
        <h3 className="sr-widget-title">呼吸練習</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  const phase = phases[idx] ?? phases[0]!
  const scale = reduced ? BIG : targetScale(phases, idx)
  // 圓在「吸/吐」時要花整個階段時間平滑變化；屏息不動 → 不需過渡。
  const transitionSeconds = reduced || phase.kind === 'hold' ? 0 : phase.seconds

  return (
    <div
      className="sr-card sr-widget"
      style={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sr-space-2)',
      }}
    >
      <h3 className="sr-widget-title">呼吸練習</h3>

      <div
        aria-hidden="true"
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          background: 'var(--sr-accent)',
          opacity: 0.85,
          transform: `scale(${scale})`,
          transition: `transform ${transitionSeconds}s ease-in-out`,
        }}
      />

      <div>
        <p style={{ margin: 0, fontSize: 'var(--sr-text-lg)', fontWeight: 600 }} aria-live="polite">
          {phase.label}
        </p>
        <p
          className="sr-muted"
          style={{ margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}
        >
          {left} 秒
        </p>
      </div>
    </div>
  )
}
