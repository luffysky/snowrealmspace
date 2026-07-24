'use client'

import { useEffect, useRef, useState } from 'react'
import type { BackgroundItem } from '@/components/BackgroundLayer'

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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(item)
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
        </div>
      </div>
    </section>
  )
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

  return (
    <div className="sr-bg-live">
      <div className="sr-bg-live-media" aria-hidden="true">
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
              transform: item.zoom !== 1 ? `scale(${item.zoom})` : undefined,
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
