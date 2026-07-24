'use client'

import { useEffect, useRef, useState } from 'react'
import { intervalMsFor, needsClientRotation, nextIndex, perLoginIndex } from '@snowrealm/validation'

/**
 * 背景渲染層。
 *
 * v1.0 §12.6 的效能要求與 ADR-019 的影片規則都在這裡：
 *   - 僅預載下一張，最多同時 2 個項目
 *   - 分頁不可見時停止影片
 *   - prefers-reduced-motion 時影片降級為靜態幀
 *   - 影片必須有使用者可見的暫停控制（WCAG Pause, Stop, Hide）
 */

export type BackgroundItem = {
  id: string
  name: string | null
  type: 'image' | 'video' | 'gradient' | 'procedural'
  asset_id: string | null
  fit: 'cover' | 'contain' | 'original'
  position_x: number
  position_y: number
  zoom: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
  overlay_color: string
  overlay_opacity: number
  loop: boolean
  muted: boolean
  glass_enabled: boolean
  glass_blur: number
  glass_opacity: number
  glass_radius: number
  glass_color: string
  crop_x: number
  crop_y: number
  crop_w: number
  crop_h: number
  gradient_spec: {
    kind: 'linear' | 'radial'
    angle: number
    stops: { color: string; position: number }[]
  } | null
}

export type BackgroundState = {
  current: BackgroundItem | null
  next: BackgroundItem | null
  transition: string
  transitionMs: number
  playMode: string
  intervalSeconds: number
  items: BackgroundItem[]
}

const SESSION_KEY = 'sr-bg-load-count'

/**
 * 決定這次載入從哪一張開始。
 *
 * per_login：每次「開啟頁面」換一張，但同一分頁重新整理不換
 * （用 sessionStorage 計數，重新整理不歸零、關掉分頁才清）。
 * 其餘模式：從伺服器解析的 current 開始。
 */
function initialIndex(state: BackgroundState): number {
  if (state.playMode !== 'per_login' || state.items.length === 0) {
    return Math.max(0, state.items.findIndex((i) => i.id === state.current?.id))
  }

  if (typeof window === 'undefined') return 0
  const raw = window.sessionStorage.getItem(SESSION_KEY)
  const count = raw ? Number(raw) : 0
  // 只在這個分頁第一次載入時 +1；重新整理會讀到已經 +1 過的值
  if (raw === null) window.sessionStorage.setItem(SESSION_KEY, String(count + 1))
  return perLoginIndex(count, state.items.length)
}

function filterFor(item: BackgroundItem): string {
  const parts: string[] = []
  if (item.blur > 0) parts.push(`blur(${item.blur}px)`)
  if (item.brightness !== 1) parts.push(`brightness(${item.brightness})`)
  if (item.contrast !== 1) parts.push(`contrast(${item.contrast})`)
  if (item.saturation !== 1) parts.push(`saturate(${item.saturation})`)
  return parts.join(' ')
}

/** 是否有裁切（非整張）。 */
function isCropped(item: BackgroundItem): boolean {
  return item.crop_x > 0 || item.crop_y > 0 || item.crop_w < 100 || item.crop_h < 100
}

/**
 * 媒體的 transform：非破壞性裁切以 transform 呈現（把裁切矩形放大填滿容器），
 * zoom 疊乘其上。沒裁切時就只有 zoom。transform-origin 在裁切時必須是左上角
 * 才對得上下面的平移數學。
 */
export function mediaTransform(item: BackgroundItem): { transform?: string; transformOrigin?: string } {
  if (isCropped(item)) {
    const sx = 100 / item.crop_w
    const sy = 100 / item.crop_h
    const tx = -(item.crop_x / item.crop_w) * 100
    const ty = -(item.crop_y / item.crop_h) * 100
    return {
      transform: `translate(${tx}%, ${ty}%) scale(${sx * item.zoom}, ${sy * item.zoom})`,
      transformOrigin: '0 0',
    }
  }
  return item.zoom !== 1 ? { transform: `scale(${item.zoom})` } : {}
}

/** #RRGGBB + 不透明度 → rgba()，讓霧面玻璃的染色用真正的 alpha，backdrop-blur 才能全效。 */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  if (!m) return `rgba(255,255,255,${alpha})`
  const r = parseInt(m[1]!, 16)
  const g = parseInt(m[2]!, 16)
  const b = parseInt(m[3]!, 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 霧面玻璃層的樣式。null = 沒開。 */
export function glassStyle(item: BackgroundItem): React.CSSProperties | null {
  if (!item.glass_enabled) return null
  const blur = `blur(${item.glass_blur}px) saturate(1.4)`
  return {
    position: 'absolute',
    inset: 0,
    background: hexToRgba(item.glass_color, item.glass_opacity),
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    borderRadius: `${item.glass_radius}px`,
  }
}

function gradientCss(item: BackgroundItem): string | null {
  const spec = item.gradient_spec
  if (!spec) return null
  const stops = spec.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ')
  return spec.kind === 'linear'
    ? `linear-gradient(${spec.angle}deg, ${stops})`
    : `radial-gradient(circle at ${item.position_x}% ${item.position_y}%, ${stops})`
}

/** 取得 asset 的 signed URL。有效期 15 分鐘，12 分後續期。 */
function useAssetUrl(spaceId: string, assetId: string | null, rendition: string) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId) {
      setUrl(null)
      return
    }
    let cancelled = false

    async function load() {
      const res = await fetch(`/api/assets/${assetId}/url?rendition=${rendition}`, {
        headers: { 'x-space-id': spaceId },
      })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as { data: { url: string } }
      if (!cancelled) setUrl(body.data.url)
    }

    void load()
    const timer = setInterval(() => void load(), 12 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [spaceId, assetId, rendition])

  return url
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** 省流量模式下也降級為靜態，與 reduced-motion 同樣處理。 */
function useSaveData(): boolean {
  const [saveData, setSaveData] = useState(false)
  useEffect(() => {
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection
    setSaveData(connection?.saveData === true)
  }, [])
  return saveData
}

function BackgroundMedia({
  spaceId,
  item,
  paused,
  onVideoPresent,
}: {
  spaceId: string
  item: BackgroundItem
  paused: boolean
  onVideoPresent: (present: boolean) => void
}) {
  const reducedMotion = useReducedMotion()
  const saveData = useSaveData()
  const videoRef = useRef<HTMLVideoElement>(null)

  // ADR-019：reduced motion 或省流量時，影片降級為第一幀靜態圖
  const degradeVideo = item.type === 'video' && (reducedMotion || saveData)
  const rendition = item.type === 'video' && !degradeVideo ? 'original' : degradeVideo ? 'poster' : 'preview'
  const url = useAssetUrl(spaceId, item.asset_id, rendition)

  const isPlayingVideo = item.type === 'video' && !degradeVideo

  useEffect(() => {
    onVideoPresent(isPlayingVideo)
    return () => onVideoPresent(false)
  }, [isPlayingVideo, onVideoPresent])

  // 分頁不可見時停止播放（v1.0 §12.6）
  useEffect(() => {
    if (!isPlayingVideo) return
    const video = videoRef.current
    if (!video) return

    const sync = () => {
      if (document.visibilityState !== 'visible' || paused) video.pause()
      else void video.play().catch(() => {})
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [isPlayingVideo, paused])

  // 聲音（ADR-019 偏離）：一律先靜音自動播放（瀏覽器 autoplay 政策要求），
  // 若使用者選了「要聲音」（item.muted === false），在第一個使用者手勢時解除靜音。
  // 沒有這個手勢，有聲音的自動播放會被瀏覽器直接擋掉、整支影片不動。
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    if (!isPlayingVideo || item.muted) return

    const unmute = () => {
      const v = videoRef.current
      if (v) {
        v.muted = false
        void v.play().catch(() => {})
      }
      document.removeEventListener('pointerdown', unmute)
      document.removeEventListener('keydown', unmute)
    }
    document.addEventListener('pointerdown', unmute, { once: true })
    document.addEventListener('keydown', unmute, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unmute)
      document.removeEventListener('keydown', unmute)
    }
  }, [isPlayingVideo, item.muted, item.id])

  const style: React.CSSProperties = {
    filter: filterFor(item) || undefined,
    objectFit: item.fit === 'original' ? 'none' : item.fit,
    objectPosition: `${item.position_x}% ${item.position_y}%`,
    ...mediaTransform(item),
  }

  if (item.type === 'gradient') {
    const css = gradientCss(item)
    return <div className="sr-bg-media" style={{ background: css ?? undefined, filter: filterFor(item) || undefined }} />
  }

  if (!url) return <div className="sr-bg-media sr-bg-loading" />

  if (isPlayingVideo) {
    return (
      <video
        ref={videoRef}
        className="sr-bg-media"
        style={style}
        src={url}
        // 先靜音自動播（autoplay 政策）；item.muted===false 時由 effect 於首次手勢解除靜音
        muted
        playsInline
        loop={item.loop}
        autoPlay
        aria-hidden="true"
      />
    )
  }

  return (
    /* 純裝飾性背景：alt="" 加 aria-hidden 已將其移出無障礙樹 */
    <img className="sr-bg-media" style={style} src={url} alt="" aria-hidden="true" />
  )
}

export function BackgroundLayer({
  spaceId,
  state,
}: {
  spaceId: string
  state: BackgroundState | null
}) {
  const [paused, setPaused] = useState(false)
  const [hasVideo, setHasVideo] = useState(false)

  // 目前顯示的索引。輪播模式會定時往前推。
  const [index, setIndex] = useState(() => (state ? initialIndex(state) : 0))
  // 轉場期間同時掛著上一張，讓它淡出
  const [leaving, setLeaving] = useState<{ item: BackgroundItem; key: number } | null>(null)
  const renderKey = useRef(0)

  const items = state?.items ?? []
  const rotate = state ? needsClientRotation(state.playMode) && items.length > 1 : false
  const intervalMs = state ? intervalMsFor(state.playMode, state.intervalSeconds) : null

  // ── 定時輪播 ──
  useEffect(() => {
    if (!rotate || intervalMs === null || paused) return

    const timer = setInterval(() => {
      setIndex((prev) => {
        const current = items[prev]
        if (current) {
          renderKey.current += 1
          setLeaving({ item: current, key: renderKey.current })
        }
        return nextIndex(prev, items.length)
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [rotate, intervalMs, paused, items])

  // 轉場結束後卸載離場的那一張，避免一直堆疊在 DOM
  useEffect(() => {
    if (!leaving || !state) return
    const timer = setTimeout(() => setLeaving(null), state.transitionMs + 100)
    return () => clearTimeout(timer)
  }, [leaving, state])

  if (!state?.current) return null

  const item = items[index] ?? state.current
  const upcoming = items[nextIndex(index, items.length)] ?? state.next

  return (
    <div
      className="sr-bg-layer"
      data-transition={state.transition}
      style={{ ['--sr-bg-transition-ms' as string]: `${state.transitionMs}ms` }}
    >
      {/* 離場的舊背景：只在轉場期間存在 */}
      {leaving && (
        <div className="sr-bg-slot" data-state="leave" key={`leave-${leaving.key}`}>
          <BackgroundMedia spaceId={spaceId} item={leaving.item} paused onVideoPresent={() => {}} />
        </div>
      )}

      {/* 目前背景。key 綁定 item.id，換張時 React 會重掛 → 觸發入場動畫 */}
      <div className="sr-bg-slot" data-state="enter" key={`enter-${item.id}`}>
        <BackgroundMedia
          spaceId={spaceId}
          item={item}
          paused={paused}
          onVideoPresent={setHasVideo}
        />
      </div>

      {item.overlay_opacity > 0 && (
        <div
          className="sr-bg-overlay"
          style={{ background: item.overlay_color, opacity: item.overlay_opacity }}
        />
      )}

      {/* 霧面玻璃層：backdrop-blur 把底下的背景＋疊色磨成毛玻璃 */}
      {glassStyle(item) && <div className="sr-bg-glass" style={glassStyle(item)!} />}

      {/* v1.0 §12.6：僅預載下一張 */}
      {upcoming && <PreloadNext spaceId={spaceId} item={upcoming} />}

      {/* WCAG 2.2 Pause, Stop, Hide：自動播放的內容必須能被停止。
          輪播本身也是自動播放的動態，所以有影片或會輪播時都顯示。 */}
      {(hasVideo || rotate) && (
        <button
          type="button"
          className="sr-bg-pause"
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
        >
          {paused ? '播放背景' : '暫停背景'}
        </button>
      )}
    </div>
  )
}

/** 預載下一張。只取 URL 並讓瀏覽器放進快取，不渲染。 */
function PreloadNext({ spaceId, item }: { spaceId: string; item: BackgroundItem }) {
  const url = useAssetUrl(spaceId, item.asset_id, item.type === 'video' ? 'poster' : 'preview')

  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.src = url
  }, [url])

  return null
}
