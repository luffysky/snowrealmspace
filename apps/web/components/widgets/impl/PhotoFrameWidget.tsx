'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { WidgetProps } from '../types'

/**
 * 相框：擺一張素材庫裡的圖。assetId 由設定面板的 AssetPicker 選（見 WidgetSettings）。
 *
 * bucket 是 private 的，圖片要走短期 signed URL（/api/assets/:id/url）。
 * 先要 medium 衍生檔；該衍生檔還沒好（404）時退回原檔（無 rendition 參數）。
 * signed URL 15 分鐘到期，這裡每 12 分重取一次，避免突然變破圖。
 *
 * 狀態誠實：載入中／取不到 URL／圖片本身載入失敗都明說，不留空殼。
 */

type Frame = '圓角' | '方框' | '無邊' | '拍立得'
type Cfg = { assetId?: string; frame?: Frame; caption?: string }
type State = 'idle' | 'loading' | 'url-error' | 'img-error'

const REFRESH_MS = 12 * 60 * 1000

export default function PhotoFrameWidget({ spaceId, config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const assetId = cfg.assetId ?? ''
  const frame: Frame = cfg.frame ?? '圓角'
  const caption = cfg.caption ?? ''

  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    if (!assetId) {
      setUrl(null)
      setState('idle')
      return
    }
    let cancelled = false
    setState('loading')

    async function load() {
      try {
        let res = await fetch(`/api/assets/${assetId}/url?rendition=medium`, {
          headers: { 'x-space-id': spaceId },
        })
        // medium 衍生檔不存在時退回原檔
        if (!res.ok) {
          res = await fetch(`/api/assets/${assetId}/url`, { headers: { 'x-space-id': spaceId } })
        }
        if (!res.ok) throw new Error()
        const body = (await res.json()) as { data: { url: string } }
        if (!cancelled) {
          setUrl(body.data.url)
          setState('idle')
        }
      } catch {
        if (!cancelled) {
          setUrl(null)
          setState('url-error')
        }
      }
    }

    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [assetId, spaceId])

  if (!assetId) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title">相框</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          到設定選一張圖。
        </p>
      </div>
    )
  }

  const polaroid = frame === '拍立得'

  // 依相框樣式決定圖片外框。
  const imgWrapStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius:
      frame === '圓角' ? 'var(--sr-radius-md)' : frame === '拍立得' ? 'var(--sr-radius-sm)' : '0',
    border: frame === '方框' ? '1px solid var(--sr-border)' : 'none',
  }

  // 拍立得：用 surface token 當「相紙」襯底（保持主題感知，不寫死白色）+ 下方說明條。
  const outerStyle: CSSProperties = polaroid
    ? {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sr-surface)',
        padding: '8px 8px 4px',
        borderRadius: 'var(--sr-radius-sm)',
        border: '1px solid var(--sr-border)',
        boxShadow: 'var(--sr-shadow-sm)',
      }
    : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }

  return (
    <div
      className="sr-card sr-widget"
      style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div style={outerStyle}>
        <div style={imgWrapStyle}>
          {state === 'loading' && (
            <span className="sr-muted" style={{ display: 'block', padding: 'var(--sr-space-2)' }}>
              載入中…
            </span>
          )}
          {state === 'url-error' && (
            <span
              className="sr-muted"
              style={{ display: 'block', padding: 'var(--sr-space-2)', color: 'var(--sr-danger)' }}
            >
              取不到圖片，請重新整理。
            </span>
          )}
          {state === 'img-error' && (
            <span
              className="sr-muted"
              style={{ display: 'block', padding: 'var(--sr-space-2)', color: 'var(--sr-danger)' }}
            >
              這張圖載入失敗了。
            </span>
          )}
          {url && state === 'idle' && (
            // signed URL 是動態短期的，不走 next/image 最佳化管線
            <img
              src={url}
              alt={caption || '相框照片'}
              onError={() => setState('img-error')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        {/* 拍立得：白底下方的說明條 */}
        {polaroid && caption && (
          <p
            style={{
              margin: '6px 2px 2px',
              color: 'var(--sr-text-secondary)',
              fontSize: 'var(--sr-text-sm)',
              textAlign: 'center',
              overflowWrap: 'anywhere',
            }}
          >
            {caption}
          </p>
        )}
      </div>

      {/* 非拍立得樣式：說明文字放相框外 */}
      {!polaroid && caption && (
        <p
          className="sr-muted"
          style={{ margin: 'var(--sr-space-1) 0 0', textAlign: 'center', overflowWrap: 'anywhere' }}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
