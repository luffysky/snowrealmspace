'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GRID,
  compactLayout,
  resolveCollisions,
  validateLayout,
  layoutHeight,
  reorderByOne,
  type GridItem,
} from '@snowrealm/widget-engine'

/**
 * 可拖曳的格線。
 *
 * 06-widget-contract.md §8：**拖曳必須有鍵盤替代方案。**
 * 這是 WCAG 2.2 的硬需求，不是加分項 —— 所以鍵盤路徑與滑鼠路徑
 * 走同一套狀態機，而不是事後補一個「無障礙模式」。
 *
 * §9：拖曳中只改 transform，不改 top/left；
 * 佈局計算在 requestAnimationFrame 內，不在 event handler。
 */

export type Breakpoint = 'desktop' | 'tablet'

type DragState = {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  origin: GridItem
} | null

export function WidgetGrid({
  items,
  breakpoint,
  editing,
  onCommit,
  renderItem,
}: {
  items: GridItem[]
  breakpoint: Breakpoint
  editing: boolean
  onCommit: (items: GridItem[]) => void
  renderItem: (item: GridItem) => React.ReactNode
}) {
  const config = GRID[breakpoint]
  const containerRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState<GridItem[]>(items)
  const [drag, setDrag] = useState<DragState>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rafRef = useRef<number | null>(null)
  /** 聚焦當下的佈局快照，供 Esc 還原。 */
  const snapshotRef = useRef<GridItem[] | null>(null)

  useEffect(() => {
    setLive(items)
  }, [items])

  const columnWidth = useCallback(() => {
    const width = containerRef.current?.clientWidth ?? 1200
    return (width - config.gap * (config.columns - 1)) / config.columns
  }, [config])

  /** 套用一次移動並解決碰撞。回傳 null 代表這次移動不合法。 */
  const applyMove = useCallback(
    (current: GridItem[], id: string, next: Partial<GridItem>): GridItem[] | null => {
      const updated = current.map((i) => (i.id === id ? { ...i, ...next } : i))
      const target = updated.find((i) => i.id === id)!

      if (target.x < 0 || target.y < 0 || target.x + target.w > config.columns) return null

      const resolved = resolveCollisions(updated, id)
      if (!resolved) return null

      const compacted = compactLayout(resolved)
      return validateLayout(compacted, config.columns).ok ? compacted : null
    },
    [config.columns],
  )

  // ── 滑鼠 / 觸控拖曳 ────────────────────────────────
  useEffect(() => {
    if (!drag) return

    function onPointerMove(event: PointerEvent) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      // 佈局計算放進 rAF，避免每個 pointermove 都同步重算（§9）
      rafRef.current = requestAnimationFrame(() => {
        const cw = columnWidth()
        const dx = Math.round((event.clientX - drag!.startX) / (cw + config.gap))
        const dy = Math.round((event.clientY - drag!.startY) / (config.rowHeight + config.gap))

        setLive((current) => {
          const next: GridItem[] | null =
            drag!.mode === 'move'
              ? applyMove(current, drag!.id, {
                  x: Math.max(0, drag!.origin.x + dx),
                  y: Math.max(0, drag!.origin.y + dy),
                })
              : applyMove(current, drag!.id, {
                  w: Math.max(1, drag!.origin.w + dx),
                  h: Math.max(1, drag!.origin.h + dy),
                })
          const resolved = next ?? current
          liveRef.current = resolved
          return resolved
        })
      })
    }

    function onPointerUp() {
      setDrag(null)
      // 只在放開時送出一次（§2.4）。從 ref 讀，不在 updater 內做副作用。
      onCommit(liveRef.current)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [drag, applyMove, columnWidth, config, onCommit])

  /**
   * 目前的佈局。
   *
   * 用 ref 而非從 setState 的 updater 讀取：
   * **updater 內不可有副作用。** React 可能重複呼叫 updater
   * （concurrent 渲染、StrictMode），把 onCommit 放進去會導致
   * 交換被套用兩次而回到原位 —— 症狀是「按方向鍵完全沒反應」。
   */
  const liveRef = useRef<GridItem[]>(items)
  useEffect(() => {
    liveRef.current = live
  }, [live])

  // ── 鍵盤（06-widget-contract.md §8）────────────────
  const nudge = useCallback(
    (id: string, delta: Partial<GridItem>, description: string) => {
      const current = liveRef.current
      const before = current.find((i) => i.id === id)
      if (!before) return

      let next = applyMove(current, id, {
        ...(delta.x !== undefined ? { x: Math.max(0, before.x + delta.x) } : {}),
        ...(delta.y !== undefined ? { y: Math.max(0, before.y + delta.y) } : {}),
        ...(delta.w !== undefined ? { w: Math.max(1, before.w + delta.w) } : {}),
        ...(delta.h !== undefined ? { h: Math.max(1, before.h + delta.h) } : {}),
      })

      // 垂直移動被重力壓縮抵銷時，改成與相鄰項目交換
      if (delta.y !== undefined) {
        const moved = next?.find((i) => i.id === id)
        const unchanged = !next || (moved?.x === before.x && moved?.y === before.y)
        if (unchanged) {
          // 用重新排版而非交換座標：寬度不同的項目互換會產生重疊
          next = reorderByOne(current, id, delta.y > 0 ? 1 : -1, config.columns)
        }
      }

      if (!next) {
        setAnnouncement(
          delta.y !== undefined
            ? delta.y > 0
              ? '已經在最下面'
              : '已經在最上面'
            : '無法移到這個位置',
        )
        return
      }

      const moved = next.find((i) => i.id === id)!
      liveRef.current = next
      setLive(next)
      // aria-live 播報新位置（§8）
      setAnnouncement(
        `${description}。第 ${moved.x + 1} 欄第 ${moved.y + 1} 列，寬 ${moved.w} 高 ${moved.h}`,
      )
      onCommit(next)
    },
    [applyMove, config.columns, onCommit],
  )

  function onKeyDown(event: React.KeyboardEvent, id: string) {
    if (!editing) return

    const shift = event.shiftKey
    const map: Record<string, [Partial<GridItem>, string]> = shift
      ? {
          ArrowLeft: [{ w: -1 }, '縮窄'],
          ArrowRight: [{ w: 1 }, '加寬'],
          ArrowUp: [{ h: -1 }, '變矮'],
          ArrowDown: [{ h: 1 }, '變高'],
        }
      : {
          ArrowLeft: [{ x: -1 }, '左移'],
          ArrowRight: [{ x: 1 }, '右移'],
          ArrowUp: [{ y: -1 }, '上移'],
          ArrowDown: [{ y: 1 }, '下移'],
        }

    const action = map[event.key]
    if (action) {
      event.preventDefault()
      nudge(id, action[0], action[1])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      /*
       * 還原到「這次聚焦時」的狀態，而不是 items prop ——
       * 每次 nudge 都已經 commit，此時 items 早就是移動後的值，
       * 用它還原等於什麼都沒做。
       */
      const snapshot = snapshotRef.current
      if (snapshot) {
        liveRef.current = snapshot
        setLive(snapshot)
        onCommit(snapshot)
        setAnnouncement('已取消，回到原本的位置')
      }
      ;(event.target as HTMLElement).blur()
      setSelectedId(null)
    }
  }

  const height = layoutHeight(live)

  return (
    <>
      {/* 螢幕閱讀器的播報區。視覺上隱藏，但必須存在於 DOM 中。 */}
      <div aria-live="polite" className="sr-visually-hidden">
        {announcement}
      </div>

      <div
        ref={containerRef}
        className="sr-widget-grid"
        data-editing={editing}
        style={{
          gridTemplateColumns: `repeat(${config.columns}, 1fr)`,
          gap: `${config.gap}px`,
          minHeight: height * (config.rowHeight + config.gap),
        }}
      >
        {live.map((item) => (
          <div
            key={item.id}
            className="sr-widget-slot"
            data-dragging={drag?.id === item.id}
            data-selected={selectedId === item.id}
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: `${item.y + 1} / span ${item.h}`,
              minHeight: item.h * config.rowHeight + (item.h - 1) * config.gap,
            }}
          >
            {editing && !item.locked && (
              <div
                className="sr-widget-handle"
                role="application"
                aria-roledescription="可移動的區塊"
                aria-label={`區塊，第 ${item.x + 1} 欄第 ${item.y + 1} 列，寬 ${item.w} 高 ${item.h}。用方向鍵移動，Shift 加方向鍵調整大小`}
                tabIndex={0}
                onFocus={() => {
                  setSelectedId(item.id)
                  // 記下這次編輯開始前的樣子
                  snapshotRef.current = liveRef.current.map((i) => ({ ...i }))
                }}
                onBlur={() => setSelectedId((prev) => (prev === item.id ? null : prev))}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                onPointerDown={(e) => {
                  e.preventDefault()
                  setSelectedId(item.id)
                  setDrag({
                    id: item.id,
                    mode: 'move',
                    startX: e.clientX,
                    startY: e.clientY,
                    origin: { ...item },
                  })
                }}
              >
                <span aria-hidden="true">⠿</span>
              </div>
            )}

            {renderItem(item)}

            {editing && !item.locked && (
              <button
                type="button"
                className="sr-widget-resize"
                aria-label={`調整大小，目前寬 ${item.w} 高 ${item.h}。用 Shift 加方向鍵調整`}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                onPointerDown={(e) => {
                  e.preventDefault()
                  setSelectedId(item.id)
                  setDrag({
                    id: item.id,
                    mode: 'resize',
                    startX: e.clientX,
                    startY: e.clientY,
                    origin: { ...item },
                  })
                }}
              >
                <span aria-hidden="true">◢</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
