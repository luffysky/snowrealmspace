'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Giphy GIF 選擇器。走宿主 app 的代理端點（金鑰在伺服器）。選一張回傳 URL。 */

type Gif = { id: string; title: string; url: string }

export function GifPicker({
  onSelect,
  giphyEndpoint = '/api/giphy',
}: {
  onSelect: (url: string) => void
  /** 宿主 app 的 Giphy 代理端點，接受 `?q=` 查詢字串。 */
  giphyEndpoint?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'unconfigured'>('idle')
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 搜尋 debounce；空字串抓 trending
  useEffect(() => {
    if (!open) return
    let alive = true
    setState('loading')
    const t = setTimeout(() => {
      void fetch(`${giphyEndpoint}?q=${encodeURIComponent(q.trim())}`)
        .then(async (r) => {
          if (r.status === 503) {
            if (alive) setState('unconfigured')
            return null
          }
          return r.ok ? r.json() : Promise.reject(new Error())
        })
        .then((body: { data?: { gifs: Gif[] } } | null) => {
          if (!alive || !body) return
          setGifs(body.data?.gifs ?? [])
          setState('idle')
        })
        .catch(() => alive && setState('error'))
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open, giphyEndpoint])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 340)) })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button ref={btnRef} type="button" className="sr-rich-btn" onClick={toggle} title="GIF" aria-label="插入 GIF">
        GIF
      </button>
      {open && mounted && pos && createPortal(
        <div ref={panelRef} className="sr-gif-panel" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="GIF 選擇器">
          <input
            className="sr-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋 GIF…"
            autoFocus
          />
          {state === 'unconfigured' ? (
            <p className="sr-muted" style={{ margin: 0 }}>Giphy 尚未設定（GIPHY_API_KEY）。</p>
          ) : state === 'error' ? (
            <p className="sr-muted" style={{ margin: 0 }}>讀不到 GIF。</p>
          ) : state === 'loading' ? (
            <p className="sr-muted" style={{ margin: 0 }}>載入中…</p>
          ) : (
            <div className="sr-gif-grid">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="sr-gif-cell"
                  onClick={() => {
                    onSelect(g.url)
                    setOpen(false)
                  }}
                  title={g.title}
                >
                  {/* giphy 縮圖，動態外部 URL；alt 用標題 */}
                  <img src={g.url} alt={g.title || 'GIF'} loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <p className="sr-muted" style={{ margin: 0, fontSize: '11px', textAlign: 'right' }}>Powered by GIPHY</p>
        </div>,
        document.body,
      )}
    </>
  )
}
