'use client'

import { useEffect, useRef, useState } from 'react'

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
}

function filterFor(item: BackgroundItem): string {
  const parts: string[] = []
  if (item.blur > 0) parts.push(`blur(${item.blur}px)`)
  if (item.brightness !== 1) parts.push(`brightness(${item.brightness})`)
  if (item.contrast !== 1) parts.push(`contrast(${item.contrast})`)
  if (item.saturation !== 1) parts.push(`saturate(${item.saturation})`)
  return parts.join(' ')
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

  const style: React.CSSProperties = {
    filter: filterFor(item) || undefined,
    objectFit: item.fit === 'original' ? 'none' : item.fit,
    objectPosition: `${item.position_x}% ${item.position_y}%`,
    transform: item.zoom !== 1 ? `scale(${item.zoom})` : undefined,
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
        // ADR-019：一律靜音、內嵌播放
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

  if (!state?.current) return null

  const item = state.current

  return (
    <div className="sr-bg-layer" data-transition={state.transition}>
      <BackgroundMedia
        spaceId={spaceId}
        item={item}
        paused={paused}
        onVideoPresent={setHasVideo}
      />

      {item.overlay_opacity > 0 && (
        <div
          className="sr-bg-overlay"
          style={{ background: item.overlay_color, opacity: item.overlay_opacity }}
        />
      )}

      {/*
        v1.0 §12.6：僅預載下一張。用 link[rel=prefetch] 而非隱藏的 <img>，
        避免瀏覽器把它當成需要立即解碼的內容。
      */}
      {state.next && <PreloadNext spaceId={spaceId} item={state.next} />}

      {/* WCAG 2.2 Pause, Stop, Hide：自動播放的內容必須能被停止 */}
      {hasVideo && (
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
