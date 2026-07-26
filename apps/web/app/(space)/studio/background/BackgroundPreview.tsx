'use client'

import { useEffect, useRef, useState } from 'react'
import { effectiveTheme, type ThemeDefinition } from '@snowrealm/theme-engine'
import { applyThemeToPreview } from '@/lib/theme/apply'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import { gradientCss } from '@/components/BackgroundLayer'
import { ProceduralScene } from '@/components/ProceduralScene'
import { LottieBackground } from '@/components/LottieBackground'
import { getScene } from '@/lib/scenes'
import { getLottieScene } from '@/lib/lottie-scenes'

/**
 * 背景即時預覽。
 *
 * 把「正在編輯 / 最近的背景」疊在目前套用的主題底下，並在上面放一張主題卡片，
 * 讓使用者看到「背景 + 我的主題內容」合在一起是什麼樣子 —— 而不是只看背景縮圖。
 * 淺/深 tab 用 effectiveTheme 切換疊在上面的主題（背景本身不變，變的是主題 UI）。
 */
export function BackgroundPreview({
  spaceId,
  item,
  theme,
}: {
  spaceId: string
  item: BackgroundItem | null
  theme: ThemeDefinition
}) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  // 疊在背景上的主題 UI 用該模式的顏色
  useEffect(() => {
    if (stageRef.current) applyThemeToPreview(effectiveTheme(theme, mode), stageRef.current)
  }, [theme, mode])

  // 圖片/影片背景需要 signed URL
  useEffect(() => {
    if (!item?.asset_id) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/assets/${item.asset_id}/url`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: { url: string } } | null) => {
        if (!cancelled) setUrl(b?.data?.url ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, item?.asset_id])

  return (
    <section className="sr-card">
      <div className="sr-preview-topline">
        <h2 className="sr-section-title" style={{ margin: 0 }}>
          即時預覽
        </h2>
        <div className="sr-mode-tabs" role="tablist" aria-label="預覽模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'light'}
            className={`sr-mode-tab ${mode === 'light' ? 'is-active' : ''}`}
            onClick={() => setMode('light')}
          >
            淺色
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'dark'}
            className={`sr-mode-tab ${mode === 'dark' ? 'is-active' : ''}`}
            onClick={() => setMode('dark')}
          >
            深色
          </button>
        </div>
      </div>
      <p className="sr-muted" style={{ marginTop: 0 }}>
        背景疊在你目前套用的主題上長這樣。{item ? '' : '選一個背景（點下方縮圖）來預覽。'}
      </p>

      <div ref={stageRef} className="sr-bg-preview-stage">
        <BgFill item={item} url={url} />
        <div className="sr-bg-preview-overlay">
          <div className="sr-card sr-bg-preview-card">
            <h3 style={{ margin: '0 0 var(--sr-space-2)' }}>今天</h3>
            <p style={{ margin: '0 0 var(--sr-space-3)' }}>背景與主題疊在一起的樣子。</p>
            <button type="button" className="sr-button">
              主要動作
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function BgFill({ item, url }: { item: BackgroundItem | null; url: string | null }) {
  if (!item) return <div className="sr-bg-preview-fill sr-bg-preview-empty" aria-hidden="true" />

  if (item.type === 'procedural') {
    const scene = getScene(item.procedural_id)
    return (
      <div className="sr-bg-preview-fill" aria-hidden="true" style={{ background: scene?.base }}>
        <ProceduralScene sceneId={item.procedural_id} />
      </div>
    )
  }

  if (item.type === 'lottie') {
    const scene = getLottieScene(item.lottie_id)
    return (
      <div className="sr-bg-preview-fill" aria-hidden="true" style={{ background: scene?.bg }}>
        <LottieBackground lottieId={item.lottie_id} />
      </div>
    )
  }

  if (item.type === 'gradient' && item.gradient_spec) {
    return (
      <div
        className="sr-bg-preview-fill"
        aria-hidden="true"
        style={{ background: gradientCss(item) ?? undefined }}
      />
    )
  }

  if (item.type === 'video' && url) {
    return (
      <video
        className="sr-bg-preview-fill"
        src={url}
        muted
        loop
        autoPlay
        playsInline
        aria-hidden="true"
      />
    )
  }

  return (
    <div className="sr-bg-preview-fill" aria-hidden="true">
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  )
}
