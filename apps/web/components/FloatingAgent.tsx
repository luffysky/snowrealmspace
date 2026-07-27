'use client'

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, ThreadSummary } from '@/app/(space)/agent/AgentChat'
import { onAgentMood, MOOD_EMOJI, type AgentMood } from '@/lib/agent/mood'

// 只有打開對話卡才載入 AgentChat（＋表情/GIF 選擇器），一般頁面不必背它
const AgentChat = lazy(() => import('@/app/(space)/agent/AgentChat').then((m) => ({ default: m.AgentChat })))

/**
 * 全站漂浮的 AI 夥伴小幫手（風格參考 AI 島綠寶導師，2D 無 VRM）。
 *
 * 收合是一顆可拖曳的漸層球（顯示會依情緒變的表情 emoji + 名字）；
 * 展開是一張浮動對話卡，直接複用 /AI 夥伴 頁的 AgentChat（autoload 自行載入最近對話）。
 * AI 情緒（LLM 吐的 ⟦mood⟧）透過 `@/lib/agent/mood` 匯流排驅動球上的 2D 表情。
 */

const OPEN_KEY = 'sr:fa-open'
const POS_KEY = 'sr:fa-pos'

const EMPTY_MESSAGES: ChatMessage[] = []
const EMPTY_THREADS: ThreadSummary[] = []

export function FloatingAgent({
  spaceId,
  userName,
  userAvatarSrc,
  agentName,
  agentAvatarSrc,
}: {
  spaceId: string
  userName: string
  userAvatarSrc: string | null
  agentName: string
  agentAvatarSrc: string | null
}) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<AgentMood>('neutral')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ dx: number; dy: number; sx: number; sy: number; w: number; h: number } | null>(null)
  const movedRef = useRef(false)
  const posRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setMounted(true)
    setOpen(localStorage.getItem(OPEN_KEY) === '1')
    try {
      const raw = localStorage.getItem(POS_KEY)
      if (raw) setPos(JSON.parse(raw) as { x: number; y: number })
    } catch {
      /* 用預設右下 */
    }
  }, [])

  // AI 情緒 → 換球上的表情
  useEffect(() => onAgentMood(setMood), [])

  function toggleOpen() {
    setOpen((o) => {
      const next = !o
      localStorage.setItem(OPEN_KEY, next ? '1' : '0')
      return next
    })
  }

  // 這顆球是「名字 pill」，寬度看名字長短（可到 ~200px），不是固定 72px 圓鈕。
  // 夾邊界一定要用「實際量到的寬高」，否則把左上角夾到 innerWidth-72 會讓 pill 右緣
  // 溢出視窗 ~130px。它是 position:fixed → body/shell 的 overflow:hidden 夾不住它，
  // 於是整頁被行動瀏覽器判定成比視窗寬、每一頁都被縮放/位移（CLAUDE.md 踩坑 #5）。
  // 量不到時（首次 render，ref 還沒接上）用保守的寬 pill 估值，寧可偏左也不溢出。
  const clampFab = useCallback((p: { x: number; y: number }) => {
    const el = fabRef.current
    const w = el?.offsetWidth || 200
    const h = el?.offsetHeight || 56
    const m = 8
    return {
      x: Math.max(m, Math.min(p.x, window.innerWidth - w - m)),
      y: Math.max(m, Math.min(p.y, window.innerHeight - h - m)),
    }
  }, [])

  // 視窗尺寸變了（尤其是旋轉：橫向存的位置到直向會超出右緣）就重新夾一次並存回。
  useEffect(() => {
    if (!mounted) return
    const reclamp = () => {
      setPos((p) => {
        if (!p) return p
        const c = clampFab(p)
        if (c.x === p.x && c.y === p.y) return p
        localStorage.setItem(POS_KEY, JSON.stringify(c))
        return c
      })
    }
    reclamp()
    window.addEventListener('resize', reclamp)
    window.addEventListener('orientationchange', reclamp)
    return () => {
      window.removeEventListener('resize', reclamp)
      window.removeEventListener('orientationchange', reclamp)
    }
  }, [mounted, clampFab])

  function onDragStart(e: React.PointerEvent) {
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, w: r.width, h: r.height }
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
  function onDragEnd(e: React.PointerEvent) {
    if (posRef.current) localStorage.setItem(POS_KEY, JSON.stringify(posRef.current))
    dragRef.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  if (!mounted) return null

  const clamped = pos ? clampFab(pos) : null
  const fabStyle: React.CSSProperties = clamped
    ? { left: clamped.x, top: clamped.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 88 }

  if (!open) {
    return (
      <button
        ref={fabRef}
        type="button"
        className="sr-fa-fab"
        style={fabStyle}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={(e) => {
          onDragEnd(e)
          if (!movedRef.current) toggleOpen()
        }}
        aria-label={`和 ${agentName} 聊聊`}
        title={`${agentName}（可拖曳）`}
      >
        <span className="sr-fa-fab-emoji">{MOOD_EMOJI[mood]}</span>
        <span className="sr-fa-fab-name">{agentName}</span>
      </button>
    )
  }

  return (
    <div className="sr-fa-panel" role="dialog" aria-label={`與 ${agentName} 對話`}>
      <div className="sr-fa-head">
        <span className="sr-fa-avatar" aria-hidden="true">
          {MOOD_EMOJI[mood]}
        </span>
        <strong className="sr-fa-title">{agentName}</strong>
        <button type="button" className="sr-fa-close" onClick={toggleOpen} aria-label="收起">
          ×
        </button>
      </div>
      <div className="sr-fa-body">
        <Suspense fallback={<p className="sr-muted" style={{ textAlign: 'center' }}>載入對話中…</p>}>
          <AgentChat
            spaceId={spaceId}
            initialThreadId={null}
            initialMessages={EMPTY_MESSAGES}
            initialThreads={EMPTY_THREADS}
            userName={userName}
            userAvatarSrc={userAvatarSrc}
            agentName={agentName}
            agentAvatarSrc={agentAvatarSrc}
            autoload
          />
        </Suspense>
      </div>
    </div>
  )
}
