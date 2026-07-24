'use client'

import { useEffect, useRef, useState } from 'react'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import { glassStyle, mediaTransform } from '@/components/BackgroundLayer'

/**
 * 單一背景的呈現設定。
 *
 * 這些值只影響「這個 background_item」，不改動底下的 asset ——
 * 同一張圖可以有白天版與夜晚版兩組設定（ADR-005）。
 *
 * 調整用 debounce 送出：拖 slider 會產生大量事件，
 * 每次都打 API 會讓伺服器與資料庫承受無意義的負載。
 */
export function BackgroundEditor({
  spaceId,
  item,
  onChange,
  onClose,
}: {
  spaceId: string
  item: BackgroundItem
  onChange: (patch: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState(item)
  // 裁切預設收起，除非這個背景本來就有裁切；不佔版面也不會「一開就卡在裁切」
  const [showCrop, setShowCrop] = useState(() => isCropped(item))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(item)
    setShowCrop(isCropped(item))
  }, [item])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function set(patch: Partial<BackgroundItem>, apiPatch: Record<string, unknown>) {
    setLocal((prev) => ({ ...prev, ...patch }))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(apiPatch), 400)
  }

  return (
    <section className="sr-card" aria-labelledby="bg-editor-title">
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="sr-section-title" id="bg-editor-title" style={{ marginBottom: 0 }}>
          調整這個背景
        </h2>
        <button type="button" className="sr-button sr-button-secondary" onClick={onClose}>
          關閉
        </button>
      </div>

      <div className="sr-bg-editor">
        <div className="sr-bg-preview-wrap">
          <LivePreview spaceId={spaceId} item={local} />
        </div>

        <div>
          <fieldset className="sr-fieldset">
            <legend className="sr-label">填滿方式</legend>
            <div className="sr-row">
              {(['cover', 'contain', 'original'] as const).map((fit) => (
                <label key={fit} className="sr-choice sr-choice-inline">
                  <input
                    type="radio"
                    name="bg-fit"
                    checked={local.fit === fit}
                    onChange={() => set({ fit }, { fit })}
                  />
                  <span>{fit === 'cover' ? '填滿' : fit === 'contain' ? '完整顯示' : '原始大小'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Slider
            id="bg-pos-x"
            label="水平位置"
            min={0}
            max={100}
            step={1}
            unit="%"
            value={local.position_x}
            onChange={(v) => set({ position_x: v }, { positionX: v })}
          />
          <Slider
            id="bg-pos-y"
            label="垂直位置"
            min={0}
            max={100}
            step={1}
            unit="%"
            value={local.position_y}
            onChange={(v) => set({ position_y: v }, { positionY: v })}
          />
          <Slider
            id="bg-zoom"
            label="縮放"
            min={0.5}
            max={4}
            step={0.05}
            value={local.zoom}
            onChange={(v) => set({ zoom: v }, { zoom: v })}
          />
          <Slider
            id="bg-blur"
            label="模糊"
            min={0}
            max={40}
            step={1}
            unit="px"
            value={local.blur}
            hint="模糊背景可以讓上層文字更好讀"
            onChange={(v) => set({ blur: v }, { blur: v })}
          />
          <Slider
            id="bg-brightness"
            label="亮度"
            min={0.2}
            max={2}
            step={0.05}
            value={local.brightness}
            onChange={(v) => set({ brightness: v }, { brightness: v })}
          />
          <Slider
            id="bg-saturation"
            label="飽和度"
            min={0}
            max={2}
            step={0.05}
            value={local.saturation}
            onChange={(v) => set({ saturation: v }, { saturation: v })}
          />
          <Slider
            id="bg-overlay"
            label="疊色濃度"
            min={0}
            max={1}
            step={0.02}
            value={local.overlay_opacity}
            hint="疊一層顏色壓暗背景，是讓文字可讀最有效的方法"
            onChange={(v) => set({ overlay_opacity: v }, { overlayOpacity: v })}
          />

          <div className="sr-field">
            <label className="sr-label" htmlFor="bg-overlay-color">
              疊色
            </label>
            <input
              type="color"
              id="bg-overlay-color"
              className="sr-color-swatch"
              value={local.overlay_color}
              onChange={(e) =>
                set({ overlay_color: e.target.value }, { overlayColor: e.target.value })
              }
            />
          </div>

          {local.type === 'gradient' && local.gradient_spec && (
            <fieldset className="sr-fieldset">
              <legend className="sr-label">顏色</legend>
              <div className="sr-row">
                {local.gradient_spec.stops.map((stop, i) => (
                  <input
                    key={i}
                    type="color"
                    className="sr-color-swatch"
                    aria-label={`色停 ${i + 1}`}
                    value={stop.color}
                    onChange={(e) => {
                      const spec = structuredClone(local.gradient_spec!)
                      spec.stops[i]!.color = e.target.value
                      set({ gradient_spec: spec }, { gradientSpec: spec })
                    }}
                  />
                ))}
              </div>
              <label className="sr-label" htmlFor="bg-grad-angle">
                角度 {local.gradient_spec.angle}°
              </label>
              <input
                id="bg-grad-angle"
                type="range"
                min={0}
                max={360}
                value={local.gradient_spec.angle}
                onChange={(e) => {
                  const spec = structuredClone(local.gradient_spec!)
                  spec.angle = Number(e.target.value)
                  set({ gradient_spec: spec }, { gradientSpec: spec })
                }}
              />
              <p className="sr-muted" style={{ marginTop: 'var(--sr-space-1)', marginBottom: 0 }}>
                兩個色停設成同一色就是純單色。
              </p>
            </fieldset>
          )}

          {local.type === 'video' && (
            <fieldset className="sr-fieldset">
              <legend className="sr-label">影片</legend>
              <label className="sr-choice sr-choice-inline">
                <input
                  type="checkbox"
                  checked={!local.muted}
                  onChange={(e) => set({ muted: !e.target.checked }, { muted: !e.target.checked })}
                />
                播放聲音
              </label>
              <label className="sr-choice sr-choice-inline">
                <input
                  type="checkbox"
                  checked={local.loop}
                  onChange={(e) => set({ loop: e.target.checked }, { loop: e.target.checked })}
                />
                循環播放
              </label>
              {!local.muted && (
                <p className="sr-muted" style={{ marginTop: 'var(--sr-space-1)', marginBottom: 0 }}>
                  瀏覽器規定：有聲音的影片要等你在頁面上點一下才會出聲，這是正常的。
                </p>
              )}
            </fieldset>
          )}

          {/* 霧面玻璃：疊在背景上的一層毛玻璃 */}
          <fieldset className="sr-fieldset">
            <legend className="sr-label">霧面玻璃</legend>
            <label className="sr-choice sr-choice-inline">
              <input
                type="checkbox"
                checked={local.glass_enabled}
                onChange={(e) => set({ glass_enabled: e.target.checked }, { glassEnabled: e.target.checked })}
              />
              加上霧面玻璃
            </label>
            {local.glass_enabled && (
              <>
                <Slider
                  id="bg-glass-blur"
                  label="霧度"
                  min={0}
                  max={60}
                  step={1}
                  unit="px"
                  value={local.glass_blur}
                  hint="越大越霧，底下的背景越模糊"
                  onChange={(v) => set({ glass_blur: v }, { glassBlur: v })}
                />
                <Slider
                  id="bg-glass-opacity"
                  label="透明度"
                  min={0}
                  max={1}
                  step={0.02}
                  value={local.glass_opacity}
                  hint="玻璃染色的濃淡；0 是純透明，1 是全不透明"
                  onChange={(v) => set({ glass_opacity: v }, { glassOpacity: v })}
                />
                <Slider
                  id="bg-glass-radius"
                  label="圓角"
                  min={0}
                  max={64}
                  step={1}
                  unit="px"
                  value={local.glass_radius}
                  onChange={(v) => set({ glass_radius: v }, { glassRadius: v })}
                />
                <div className="sr-field">
                  <label className="sr-label" htmlFor="bg-glass-color">
                    玻璃顏色
                  </label>
                  <input
                    type="color"
                    id="bg-glass-color"
                    className="sr-color-swatch"
                    value={local.glass_color}
                    onChange={(e) => set({ glass_color: e.target.value }, { glassColor: e.target.value })}
                  />
                </div>
              </>
            )}
          </fieldset>

          {/* 裁切：只對圖片/影片有意義，漸層沒有可裁的來源 */}
          {(local.type === 'image' || local.type === 'video') && local.asset_id && (
            <fieldset className="sr-fieldset">
              <legend className="sr-label">裁切</legend>
              <label className="sr-choice sr-choice-inline">
                <input
                  type="checkbox"
                  checked={showCrop}
                  onChange={(e) => {
                    const on = e.target.checked
                    setShowCrop(on)
                    // 關閉裁切＝還原成整張
                    if (!on && isCropped(local)) {
                      set(
                        { crop_x: 0, crop_y: 0, crop_w: 100, crop_h: 100 },
                        { cropX: 0, cropY: 0, cropW: 100, cropH: 100 },
                      )
                    }
                  }}
                />
                裁切這張圖片
              </label>
              {showCrop && <CropEditor spaceId={spaceId} item={local} onChange={set} />}
            </fieldset>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * 非破壞性裁切：拖動方框選要保留的區域（移動＝拖框身，縮放＝拖右下角把手）。
 * 只改這個背景的裁切矩形，不動 asset 位元組（ADR-005）。
 */
function CropEditor({
  spaceId,
  item,
  onChange,
}: {
  spaceId: string
  item: BackgroundItem
  onChange: (patch: Partial<BackgroundItem>, apiPatch: Record<string, unknown>) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!item.asset_id) return
    let cancelled = false
    void fetch(`/api/assets/${item.asset_id}/url?rendition=preview`, {
      headers: { 'x-space-id': spaceId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: { url: string } } | null) => {
        if (!cancelled) setUrl(b?.data?.url ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, item.asset_id])

  const cx = item.crop_x
  const cy = item.crop_y
  const cw = item.crop_w
  const ch = item.crop_h

  function commit(next: { x: number; y: number; w: number; h: number }) {
    onChange(
      { crop_x: next.x, crop_y: next.y, crop_w: next.w, crop_h: next.h },
      { cropX: next.x, cropY: next.y, cropW: next.w, cropH: next.h },
    )
  }

  // 拖曳：mode='move' 移動整框，mode='resize' 拉右下角。座標換算成容器百分比。
  function startDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const wrap = boxRef.current?.parentElement
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const orig = { x: cx, y: cy, w: cw, h: ch }
    ;(e.target as Element).setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100
      const dyPct = ((ev.clientY - startY) / rect.height) * 100
      if (mode === 'move') {
        const x = clamp(orig.x + dxPct, 0, 100 - orig.w)
        const y = clamp(orig.y + dyPct, 0, 100 - orig.h)
        commit({ x, y, w: orig.w, h: orig.h })
      } else {
        const w = clamp(orig.w + dxPct, 5, 100 - orig.x)
        const h = clamp(orig.h + dyPct, 5, 100 - orig.y)
        commit({ x: orig.x, y: orig.y, w, h })
      }
    }
    const onUp = (ev: PointerEvent) => {
      ;(e.target as Element).releasePointerCapture?.(ev.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const cropped = cx > 0 || cy > 0 || cw < 100 || ch < 100

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
      {/* overflow:hidden 很重要：裁切框的暗遮罩用 box-shadow 撐超大，
          沒有這層 clip 會蓋滿整個頁面、把其他控制項都遮在暗幕後面 */}
      <div
        className="sr-crop-wrap"
        style={{
          position: 'relative',
          width: '100%',
          userSelect: 'none',
          overflow: 'hidden',
          borderRadius: 'var(--sr-radius-sm, 6px)',
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--sr-radius-sm, 6px)' }}
          />
        ) : (
          <div className="sr-bg-loading" style={{ width: '100%', aspectRatio: '16 / 9' }} />
        )}
        {/* 保留區域外的暗遮罩用 box-shadow 撐出無限大 */}
        <div
          ref={boxRef}
          className="sr-crop-box"
          onPointerDown={(e) => startDrag('move', e)}
          style={{ left: `${cx}%`, top: `${cy}%`, width: `${cw}%`, height: `${ch}%` }}
        >
          <span
            className="sr-crop-handle"
            onPointerDown={(e) => startDrag('resize', e)}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm, 0.85rem)' }}>
          {cropped ? `裁切 ${Math.round(cw)}% × ${Math.round(ch)}%` : '整張（未裁切）'}
        </span>
        {cropped && (
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => commit({ x: 0, y: 0, w: 100, h: 100 })}
          >
            重設裁切
          </button>
        )}
      </div>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function isCropped(item: BackgroundItem): boolean {
  return item.crop_x > 0 || item.crop_y > 0 || item.crop_w < 100 || item.crop_h < 100
}

function LivePreview({ spaceId, item }: { spaceId: string; item: BackgroundItem }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!item.asset_id) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/assets/${item.asset_id}/url?rendition=preview`, {
      headers: { 'x-space-id': spaceId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: { url: string } } | null) => {
        if (!cancelled) setUrl(b?.data?.url ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, item.asset_id])

  const filter = [
    item.blur > 0 ? `blur(${item.blur}px)` : '',
    item.brightness !== 1 ? `brightness(${item.brightness})` : '',
    item.contrast !== 1 ? `contrast(${item.contrast})` : '',
    item.saturation !== 1 ? `saturate(${item.saturation})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const gradient =
    item.type === 'gradient' && item.gradient_spec
      ? `linear-gradient(${item.gradient_spec.angle}deg, ${item.gradient_spec.stops
          .map((s) => `${s.color} ${s.position}%`)
          .join(', ')})`
      : null

  const glass = glassStyle(item)

  return (
    <div className="sr-bg-live">
      <div className="sr-bg-live-media" aria-hidden="true" style={{ overflow: 'hidden' }}>
        {gradient ? (
          <div style={{ inset: 0, position: 'absolute', background: gradient, filter }} />
        ) : url ? (
          <img
            src={url}
            alt=""
            style={{
              filter,
              objectFit: item.fit === 'original' ? 'none' : item.fit,
              objectPosition: `${item.position_x}% ${item.position_y}%`,
              ...mediaTransform(item),
            }}
          />
        ) : null}
        {item.overlay_opacity > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: item.overlay_color,
              opacity: item.overlay_opacity,
            }}
          />
        )}
        {glass && <div style={glass} />}
      </div>

      {/* 疊上真實的卡片與文字 —— 調背景時最重要的是「文字還讀得到嗎」 */}
      <div className="sr-bg-live-content">
        <div className="sr-card">
          <strong>文字在這個背景上看起來如何</strong>
          <p className="sr-muted" style={{ marginBottom: 0 }}>
            次要文字也要讀得到。
          </p>
        </div>
      </div>
    </div>
  )
}

function Slider({
  id,
  label,
  min,
  max,
  step,
  unit,
  value,
  hint,
  onChange,
}: {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
  value: number
  hint?: string
  onChange: (value: number) => void
}) {
  const display = step < 1 ? value.toFixed(2) : String(value)
  return (
    <div className="sr-field">
      <label className="sr-label" htmlFor={id}>
        {label}
        <span className="sr-muted" style={{ fontWeight: 400 }}>
          {' '}
          {display}
          {unit ?? ''}
        </span>
      </label>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p className="sr-muted" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}
