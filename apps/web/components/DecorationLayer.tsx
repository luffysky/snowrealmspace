'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { NEUTRAL } from '@snowrealm/theme-engine'
import {
  DECORATION_CATEGORIES,
  decorationSrc,
  decorationsByCategory,
  type DecorationCategoryKey,
} from '@/lib/decorations'

/**
 * 全站裝飾品 overlay。
 *
 * 使用者把可愛小圖（Fluent Emoji）自由擺在空間頁面上，可調大小/旋轉/透明度、
 * 選配漸層染色。每個 space 一組，浮在所有頁面之上。
 *
 * 兩種模式：
 * - 檢視（預設）：整層與每張圖都 pointer-events:none，永遠不擋任何點擊/點按（關鍵）。
 * - 編輯（網址帶 ?decorate=1）：圖變成可拖曳，選取後出現控制面板；「＋ 加入裝飾」
 *   開挑選器，「完成」移除查詢參數離開編輯。
 *
 * 位置以視窗比例（0..1）存，換裝置也擺得對。染色時把 emoji 當剪影填漸層
 * （mask-image + linear-gradient）；沒染色就顯示原圖。透明度一律套用。
 */

type Tint = { from: string; to: string; angle: number }

type DecoRecord = {
  id: string
  decoration_id: string
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  tint: Tint | null
  z_index: number
}

export function DecorationLayer({ spaceId }: { spaceId: string }) {
  // useSearchParams 需要 Suspense 邊界，否則會把整頁降級成 client render。
  return (
    <Suspense fallback={null}>
      <DecorationLayerInner spaceId={spaceId} />
    </Suspense>
  )
}

function DecorationLayerInner({ spaceId }: { spaceId: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const editMode = searchParams.get('decorate') === '1'

  const [items, setItems] = useState<DecoRecord[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 對齊格線：開啟時顯示格線、拖曳吸附到格點（像 widget，但可關掉回純自由擺放）。
  // gridDiv = 視窗切成幾格（等分數）；數字大＝格子小。用 ref 讓拖曳中的 handler 讀到最新值。
  const [snap, setSnap] = useState(false)
  const [gridDiv, setGridDiv] = useState(20)
  const snapRef = useRef(false)
  const gridDivRef = useRef(20)
  snapRef.current = snap
  gridDivRef.current = gridDiv

  const api = useCallback(
    async (path: string, init?: RequestInit): Promise<unknown> => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-space-id': spaceId,
          ...(init?.headers ?? {}),
        },
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。',
        )
      }
      return (body as { data?: unknown } | null)?.data
    },
    [spaceId],
  )

  // 初次載入：抓這個 space 的裝飾。載完前不畫任何東西（不擺假圖）。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = (await api('/api/decorations')) as DecoRecord[]
        if (!cancelled) setItems(data)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  // ── 防抖 PATCH：拖曳/拉桿頻繁觸發，累積各欄位後一次送出 ──
  const pending = useRef<Map<string, Record<string, unknown>>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const sendPatch = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      try {
        await api(`/api/decorations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      } catch (err) {
        // 靜默失敗是 bug：明講，並重載回伺服器真值。
        setError(err instanceof Error ? err.message : '調整沒有存到。')
        try {
          const fresh = (await api('/api/decorations')) as DecoRecord[]
          setItems(fresh)
        } catch {
          /* 保持現狀 */
        }
      }
    },
    [api],
  )

  const flush = useCallback(
    (id: string) => {
      const patch = pending.current.get(id)
      pending.current.delete(id)
      timers.current.delete(id)
      if (patch && Object.keys(patch).length) void sendPatch(id, patch)
    },
    [sendPatch],
  )

  const schedulePatch = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch })
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      timers.current.set(id, setTimeout(() => flush(id), 250))
    },
    [flush],
  )

  // 卸載時把還沒送出的變更清乾淨（避免 setState-after-unmount 與遺漏）。
  useEffect(() => {
    const t = timers.current
    return () => {
      for (const timer of t.values()) clearTimeout(timer)
    }
  }, [])

  // 本地樂觀更新單一裝飾。
  const applyLocal = useCallback((id: string, patch: Partial<DecoRecord>) => {
    setItems((prev) => (prev ? prev.map((d) => (d.id === id ? { ...d, ...patch } : d)) : prev))
  }, [])

  // ── 拖曳 ──
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)

  const onItemPointerDown = useCallback(
    (e: ReactPointerEvent, rec: DecoRecord) => {
      if (!editMode) return
      e.stopPropagation()
      setSelectedId(rec.id)
      const vw = document.documentElement.clientWidth || window.innerWidth
      const vh = document.documentElement.clientHeight || window.innerHeight
      // 記錄指標與中心的偏移，拖曳時不跳動。
      dragRef.current = {
        id: rec.id,
        dx: e.clientX - rec.x * vw,
        dy: e.clientY - rec.y * vh,
        moved: false,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [editMode],
  )

  const onItemPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = dragRef.current
      if (!d) return
      d.moved = true
      const vw = document.documentElement.clientWidth || window.innerWidth
      const vh = document.documentElement.clientHeight || window.innerHeight
      let x = Math.min(1, Math.max(0, (e.clientX - d.dx) / vw))
      let y = Math.min(1, Math.max(0, (e.clientY - d.dy) / vh))
      // 對齊格線：吸附到最近的格點（step = 1/等分數）。
      if (snapRef.current) {
        const step = 1 / gridDivRef.current
        x = Math.min(1, Math.max(0, Math.round(x / step) * step))
        y = Math.min(1, Math.max(0, Math.round(y / step) * step))
      }
      applyLocal(d.id, { x, y })
      schedulePatch(d.id, { x, y })
    },
    [applyLocal, schedulePatch],
  )

  // 拖曳結束立刻落地，不等防抖。
  const flushImmediate = useCallback(
    (id: string) => {
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      flush(id)
    },
    [flush],
  )

  const onItemPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      if (d) flushImmediate(d.id)
    },
    [flushImmediate],
  )

  // ── 屬性調整（拉桿 / 染色） ──
  const updateField = useCallback(
    (id: string, patch: Partial<DecoRecord> & Record<string, unknown>, apiPatch: Record<string, unknown>) => {
      applyLocal(id, patch)
      schedulePatch(id, apiPatch)
    },
    [applyLocal, schedulePatch],
  )

  // ── 加入 / 刪除 / 複製 ──
  const addDecoration = useCallback(
    async (decorationId: string, x = 0.5, y = 0.42) => {
      // 對齊格線開啟時，新加入的裝飾也落在格點上。
      if (snapRef.current) {
        const step = 1 / gridDivRef.current
        x = Math.min(1, Math.max(0, Math.round(x / step) * step))
        y = Math.min(1, Math.max(0, Math.round(y / step) * step))
      }
      try {
        const created = (await api('/api/decorations', {
          method: 'POST',
          body: JSON.stringify({ decorationId, x, y }),
        })) as DecoRecord
        setItems((prev) => [...(prev ?? []), created])
        setSelectedId(created.id)
        setShowPicker(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加入失敗。')
      }
    },
    [api],
  )

  const removeDecoration = useCallback(
    async (id: string) => {
      const snapshot = items
      setItems((prev) => (prev ? prev.filter((d) => d.id !== id) : prev))
      if (selectedId === id) setSelectedId(null)
      try {
        await api(`/api/decorations/${id}`, { method: 'DELETE' })
      } catch (err) {
        setError(err instanceof Error ? err.message : '移除失敗。')
        setItems(snapshot) // 回滾
      }
    },
    [api, items, selectedId],
  )

  const duplicateDecoration = useCallback(
    async (rec: DecoRecord) => {
      try {
        const nx = Math.min(1, rec.x + 0.04)
        const ny = Math.min(1, rec.y + 0.04)
        const created = (await api('/api/decorations', {
          method: 'POST',
          body: JSON.stringify({ decorationId: rec.decoration_id, x: nx, y: ny }),
        })) as DecoRecord
        // 沿用外觀（大小/旋轉/透明度/染色）
        await api(`/api/decorations/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            scale: rec.scale,
            rotation: rec.rotation,
            opacity: rec.opacity,
            tint: rec.tint,
          }),
        })
        const copy: DecoRecord = {
          ...rec,
          id: created.id,
          x: nx,
          y: ny,
        }
        setItems((prev) => [...(prev ?? []), copy])
        setSelectedId(created.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : '複製失敗。')
      }
    },
    [api],
  )

  const exitEdit = useCallback(() => {
    setSelectedId(null)
    setShowPicker(false)
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const selected = useMemo(
    () => (selectedId ? (items?.find((d) => d.id === selectedId) ?? null) : null),
    [selectedId, items],
  )

  // 載入中：什麼都不畫（誠實，不擺假圖）。
  if (!items) return null

  return (
    <div
      className={`sr-deco-layer${editMode ? ' sr-deco-layer-edit' : ''}${editMode && snap ? ' sr-deco-layer-grid' : ''}`}
      // 檢視模式整層不攔截點擊；編輯模式由各互動元素自行開 pointer-events。
      // 對齊格線開啟時，用 CSS 變數帶入格線間距（＝視窗等分），畫出對齊參考格。
      style={
        editMode && snap
          ? ({ ['--sr-deco-grid']: `${100 / gridDiv}%` } as CSSProperties)
          : undefined
      }
      aria-hidden={editMode ? undefined : 'true'}
    >
      {items.map((rec) => (
        <DecoVisual
          key={rec.id}
          rec={rec}
          editMode={editMode}
          selected={editMode && rec.id === selectedId}
          onPointerDown={onItemPointerDown}
          onPointerMove={onItemPointerMove}
          onPointerUp={onItemPointerUp}
        />
      ))}

      {editMode && (
        <>
          <div className="sr-deco-toolbar" role="toolbar" aria-label="裝飾品編輯">
            <span className="sr-deco-toolbar-hint">拖曳擺放 · 點選可調整</span>
            <div className="sr-deco-toolbar-actions">
              <button
                type="button"
                className={`sr-button sr-button-secondary${snap ? ' sr-button-active' : ''}`}
                aria-pressed={snap}
                onClick={() => setSnap((s) => !s)}
                title="開啟後拖曳會吸附到格線"
              >
                {snap ? '✓ 對齊格線' : '對齊格線'}
              </button>
              {snap && (
                <label className="sr-deco-grid-size" title="格子大小（往右格子越小）">
                  <span aria-hidden="true">格</span>
                  <input
                    type="range"
                    min={6}
                    max={48}
                    step={2}
                    value={gridDiv}
                    aria-label="格子大小，往右格子越小"
                    onChange={(e) => setGridDiv(Number(e.target.value))}
                  />
                </label>
              )}
              <button type="button" className="sr-button sr-button-secondary" onClick={() => setShowPicker(true)}>
                ＋ 加入裝飾
              </button>
              <button type="button" className="sr-button" onClick={exitEdit}>
                完成
              </button>
            </div>
          </div>

          {error && (
            <p className="sr-deco-error sr-message sr-message-error" role="alert">
              ✕ {error}
            </p>
          )}

          {selected && (
            <DecorationPanel
              rec={selected}
              onChange={updateField}
              onCommit={flushImmediate}
              onDelete={() => void removeDecoration(selected.id)}
              onDuplicate={() => void duplicateDecoration(selected)}
              onClose={() => setSelectedId(null)}
            />
          )}

          {showPicker && (
            <DecorationPicker onPick={(id) => void addDecoration(id)} onClose={() => setShowPicker(false)} />
          )}
        </>
      )}
    </div>
  )
}

/** 單張裝飾的視覺呈現（染色時為漸層剪影，否則原圖）。 */
function DecoVisual({
  rec,
  editMode,
  selected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  rec: DecoRecord
  editMode: boolean
  selected: boolean
  onPointerDown: (e: ReactPointerEvent, rec: DecoRecord) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
}) {
  const src = decorationSrc(rec.decoration_id)
  const style: CSSProperties = {
    left: `${rec.x * 100}vw`,
    top: `${rec.y * 100}vh`,
    transform: `translate(-50%, -50%) rotate(${rec.rotation}deg) scale(${rec.scale})`,
    opacity: rec.opacity,
    zIndex: rec.z_index,
    // 關鍵：檢視模式一律 none，永遠不擋點擊；編輯模式才可互動。
    pointerEvents: editMode ? 'auto' : 'none',
  }

  return (
    <div
      className={`sr-deco-item${editMode ? ' sr-deco-item-edit' : ''}${selected ? ' sr-deco-item-selected' : ''}`}
      style={style}
      onPointerDown={editMode ? (e) => onPointerDown(e, rec) : undefined}
      onPointerMove={editMode ? onPointerMove : undefined}
      onPointerUp={editMode ? onPointerUp : undefined}
    >
      {rec.tint ? (
        <span
          className="sr-deco-visual sr-deco-tint"
          aria-hidden="true"
          style={{
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            background: `linear-gradient(${rec.tint.angle}deg, ${rec.tint.from}, ${rec.tint.to})`,
          }}
        />
      ) : (
        <img className="sr-deco-visual" src={src} alt="" aria-hidden="true" draggable={false} />
      )}
    </div>
  )
}

/** 選取後的浮動控制面板。 */
function DecorationPanel({
  rec,
  onChange,
  onCommit,
  onDelete,
  onDuplicate,
  onClose,
}: {
  rec: DecoRecord
  onChange: (
    id: string,
    patch: Partial<DecoRecord> & Record<string, unknown>,
    apiPatch: Record<string, unknown>,
  ) => void
  onCommit: (id: string) => void
  onDelete: () => void
  onDuplicate: () => void
  onClose: () => void
}) {
  const enableTint = () => {
    const [from, to] = readTintSeed()
    onChange(rec.id, { tint: { from, to, angle: 135 } }, { tint: { from, to, angle: 135 } })
  }
  const setTint = (patch: Partial<Tint>) => {
    if (!rec.tint) return
    const next: Tint = { ...rec.tint, ...patch }
    onChange(rec.id, { tint: next }, { tint: next })
  }
  const clearTint = () => onChange(rec.id, { tint: null }, { tint: null })

  return (
    <section className="sr-deco-panel" aria-label="裝飾品調整">
      <div className="sr-deco-panel-head">
        <span className="sr-deco-panel-title">調整裝飾</span>
        <button type="button" className="sr-deco-panel-close" onClick={onClose} aria-label="收起">
          ✕
        </button>
      </div>

      <label className="sr-deco-field">
        <span className="sr-deco-field-label">大小</span>
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.05}
          value={rec.scale}
          onChange={(e) => onChange(rec.id, { scale: Number(e.target.value) }, { scale: Number(e.target.value) })}
          onPointerUp={() => onCommit(rec.id)}
        />
      </label>

      <label className="sr-deco-field">
        <span className="sr-deco-field-label">旋轉</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rec.rotation}
          onChange={(e) => onChange(rec.id, { rotation: Number(e.target.value) }, { rotation: Number(e.target.value) })}
          onPointerUp={() => onCommit(rec.id)}
        />
      </label>

      <label className="sr-deco-field">
        <span className="sr-deco-field-label">透明度</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={rec.opacity}
          onChange={(e) => onChange(rec.id, { opacity: Number(e.target.value) }, { opacity: Number(e.target.value) })}
          onPointerUp={() => onCommit(rec.id)}
        />
      </label>

      <div className="sr-deco-field sr-deco-field-tint">
        <span className="sr-deco-field-label">顏色</span>
        {rec.tint ? (
          <div className="sr-deco-tint-controls">
            <input
              type="color"
              aria-label="漸層起色"
              value={rec.tint.from}
              onChange={(e) => setTint({ from: e.target.value })}
              onBlur={() => onCommit(rec.id)}
            />
            <input
              type="color"
              aria-label="漸層迄色"
              value={rec.tint.to}
              onChange={(e) => setTint({ to: e.target.value })}
              onBlur={() => onCommit(rec.id)}
            />
            <input
              type="range"
              aria-label="漸層角度"
              min={0}
              max={360}
              step={5}
              value={rec.tint.angle}
              onChange={(e) => setTint({ angle: Number(e.target.value) })}
              onPointerUp={() => onCommit(rec.id)}
            />
            <button type="button" className="sr-chip" onClick={clearTint}>
              無
            </button>
          </div>
        ) : (
          <button type="button" className="sr-chip" onClick={enableTint}>
            加上顏色
          </button>
        )}
      </div>

      <div className="sr-deco-panel-actions">
        <button type="button" className="sr-button sr-button-secondary" onClick={onDuplicate}>
          複製
        </button>
        <button type="button" className="sr-button sr-button-danger" onClick={onDelete}>
          刪除
        </button>
      </div>
    </section>
  )
}

/** 挑選器：81 個裝飾依 6 類分組，點一下即加入。 */
function DecorationPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState<DecorationCategoryKey>('animal')
  const list = decorationsByCategory(cat)

  return (
    <section className="sr-deco-picker" aria-label="選擇裝飾">
      <div className="sr-deco-picker-head">
        <span className="sr-deco-panel-title">加入裝飾</span>
        <button type="button" className="sr-deco-panel-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
      </div>

      <div className="sr-chip-row" role="tablist" aria-label="裝飾分類">
        {DECORATION_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={cat === c.key}
            className={`sr-chip${cat === c.key ? ' sr-chip-active' : ''}`}
            onClick={() => setCat(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="sr-deco-picker-grid">
        {list.map((d) => (
          <button
            key={d.id}
            type="button"
            className="sr-deco-picker-tile"
            title={`加入「${d.label}」`}
            aria-label={`加入「${d.label}」`}
            onClick={() => onPick(d.id)}
          >
            <img src={decorationSrc(d.id)} alt="" aria-hidden="true" draggable={false} />
            <span className="sr-deco-picker-label">{d.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * 漸層預設色取自目前套用的主題（--sr-primary / --sr-accent），讓新染色與空間協調；
 * 讀不到合法 #RRGGBB 時退回柔和的粉/藍（染色屬美術內容，非 UI chrome）。
 */
function readTintSeed(): [string, string] {
  if (typeof window === 'undefined') return [NEUTRAL.white, NEUTRAL.nearBlack]
  const style = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim()
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  }
  return [pick('--sr-primary', NEUTRAL.white), pick('--sr-accent', NEUTRAL.nearBlack)]
}
