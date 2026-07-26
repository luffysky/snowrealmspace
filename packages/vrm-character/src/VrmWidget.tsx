'use client'

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { onVrm } from './bus'

/**
 * 全站漂浮的 VRM 角色 widget（移植自 insight-engine 的角色功能）。
 *
 * 收合時是一顆小球，展開是可拖曳的角色面板（雪凜／凜空可切換）。
 * three.js 只能在 client 跑 → 用 React.lazy 動態載入；`mounted` guard 保證
 * 只在 client（mount 後）才渲染 lazy 場景，因此 SSR 不會踩到 three.js（不綁 Next）。
 * 角色會依 `./bus` 的訊號反應（宿主的對話端 emit 情緒/動作/朗讀）。
 */

const YukirinScene = lazy(() => import('./YukirinScene'))
const RikuScene = lazy(() => import('./RikuScene'))

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
  const dragRef = useRef<{ dx: number; dy: number; sx: number; sy: number; w: number; h: number } | null>(null)
  const movedRef = useRef(false)
  const posRef = useRef<{ x: number; y: number } | null>(null)

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

  // 拖曳 —— 收合的球與展開的標題列共用。用元素實際位置起算，兩種尺寸都對。
  function onDragStart(e: React.PointerEvent) {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      sx: e.clientX,
      sy: e.clientY,
      w: rect.width,
      h: rect.height,
    }
    movedRef.current = false
    el.setPointerCapture(e.pointerId)
  }
  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) movedRef.current = true
    const x = Math.max(4, Math.min(window.innerWidth - d.w - 4, e.clientX - d.dx))
    const y = Math.max(4, Math.min(window.innerHeight - d.h - 4, e.clientY - d.dy))
    posRef.current = { x, y }
    setPos({ x, y })
  }
  function onDragEnd() {
    if (posRef.current) localStorage.setItem(POS_KEY, JSON.stringify(posRef.current))
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
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={(e) => {
          onDragEnd()
          if (!movedRef.current) toggleOpen() // 有拖曳就不當作點擊
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        }}
        aria-label="打開 AI 夥伴角色"
        title="AI 夥伴（可拖曳）"
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
        <Suspense fallback={<div className="sr-vrm-loading">載入角色中…</div>}>
          {char === 'yukirin' ? (
            <YukirinScene cameraMode="upperBody" showBackground={false} onLoad={onLoad} />
          ) : (
            <RikuScene cameraMode="upperBody" showBackground={false} onLoad={onLoad} />
          )}
        </Suspense>
      </div>
    </div>
  )
}
