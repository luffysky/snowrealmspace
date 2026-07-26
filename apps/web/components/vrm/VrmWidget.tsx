'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { onVrm } from '@/lib/vrm/bus'

/**
 * 全站漂浮的 VRM 角色 widget（移植自 insight-engine 的角色功能）。
 *
 * 收合時是一顆小球，展開是可拖曳的角色面板（雪凜／凜空可切換）。
 * three.js 只能在 client 跑 → 兩個場景都用 dynamic(ssr:false) 載入。
 * 角色會依 `@/lib/vrm/bus` 的訊號反應（Agent 對話端 emit 情緒/動作/朗讀）。
 */

const YukirinScene = dynamic(() => import('./YukirinScene'), { ssr: false })
const RikuScene = dynamic(() => import('./RikuScene'), { ssr: false })

type Char = 'yukirin' | 'riku'

/** 兩個場景 onLoad 控制物件的共同子集。 */
type CharControls = {
  setMood: (mood: string, durationMs?: number) => void
  playAnimation: (name: string) => void
  speak: (text: string) => void
  stopSpeaking: () => void
}

const CHAR_KEY = 'sr:vrm-char'
const OPEN_KEY = 'sr:vrm-open'
const POS_KEY = 'sr:vrm-pos'
const PANEL_W = 260
const PANEL_H = 340

const CHAR_LABEL: Record<Char, string> = { yukirin: '雪凜', riku: '凜空' }

export function VrmWidget() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [char, setChar] = useState<Char>('yukirin')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const controlsRef = useRef<CharControls | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => {
    setMounted(true)
    const savedChar = localStorage.getItem(CHAR_KEY)
    if (savedChar === 'yukirin' || savedChar === 'riku') setChar(savedChar)
    setOpen(localStorage.getItem(OPEN_KEY) === '1')
    try {
      const raw = localStorage.getItem(POS_KEY)
      if (raw) setPos(JSON.parse(raw) as { x: number; y: number })
    } catch {
      /* 無效就用預設右下角 */
    }
  }, [])

  // AI 反應：收 bus 訊號 → 驅動角色
  useEffect(() => {
    return onVrm((s) => {
      const c = controlsRef.current
      if (!c) return
      if (s.type === 'mood') c.setMood(s.mood)
      else if (s.type === 'animation') c.playAnimation(s.name)
      else if (s.type === 'speak') c.speak(s.text)
      else if (s.type === 'stop') c.stopSpeaking()
    })
  }, [])

  const onLoad = useCallback((c: unknown) => {
    controlsRef.current = c as CharControls
  }, [])

  function toggleOpen() {
    setOpen((o) => {
      const next = !o
      localStorage.setItem(OPEN_KEY, next ? '1' : '0')
      return next
    })
  }

  function switchChar() {
    setChar((c) => {
      const next: Char = c === 'yukirin' ? 'riku' : 'yukirin'
      localStorage.setItem(CHAR_KEY, next)
      controlsRef.current = null // 換角色 → 舊控制失效，等新場景 onLoad
      return next
    })
  }

  // 拖曳（在標題列）
  function onDragStart(e: React.PointerEvent) {
    const startX = pos?.x ?? window.innerWidth - PANEL_W - 20
    const startY = pos?.y ?? window.innerHeight - PANEL_H - 20
    dragRef.current = { dx: e.clientX - startX, dy: e.clientY - startY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const x = Math.max(4, Math.min(window.innerWidth - PANEL_W - 4, e.clientX - dragRef.current.dx))
    const y = Math.max(4, Math.min(window.innerHeight - 40, e.clientY - dragRef.current.dy))
    setPos({ x, y })
  }
  function onDragEnd() {
    if (dragRef.current && pos) localStorage.setItem(POS_KEY, JSON.stringify(pos))
    dragRef.current = null
  }

  if (!mounted) return null

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 20 }

  if (!open) {
    return (
      <button
        type="button"
        className="sr-vrm-fab"
        style={style}
        onClick={toggleOpen}
        aria-label="打開 AI 夥伴角色"
        title="AI 夥伴"
      >
        🧊
      </button>
    )
  }

  return (
    <div className="sr-vrm-panel" style={{ ...style, width: PANEL_W, height: PANEL_H }}>
      <div
        className="sr-vrm-bar"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <button
          type="button"
          className="sr-vrm-bar-btn"
          onClick={switchChar}
          title="切換角色"
          onPointerDown={(e) => e.stopPropagation()}
        >
          ⇄ {CHAR_LABEL[char]}
        </button>
        <button
          type="button"
          className="sr-vrm-bar-btn"
          onClick={toggleOpen}
          aria-label="收起"
          title="收起"
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      </div>
      <div className="sr-vrm-canvas">
        {char === 'yukirin' ? (
          <YukirinScene cameraMode="upperBody" showBackground={false} allowOrbit onLoad={onLoad} />
        ) : (
          <RikuScene cameraMode="upperBody" showBackground={false} allowOrbit onLoad={onLoad} />
        )}
      </div>
    </div>
  )
}
