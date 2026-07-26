'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * GIF 選擇器（移植自 AI 島）：分類快捷 + 搜尋 + 分頁 + 3 欄格。
 * 走宿主的 /api/giphy 代理（金鑰在伺服器，不外露）。portal + fixed 定位，底部空間不夠往上開。
 */

type Gif = { id: string; title: string; url: string }
type FetchState = 'idle' | 'loading' | 'error' | 'unconfigured'

const PANEL_W = 320
const PER_PAGE = 12

// label → 搜尋詞（'' = 熱門 trending）
const CATS: { label: string; q: string }[] = [
  { label: '🔥 熱門', q: '' },
  { label: '😂 大笑', q: 'lol' },
  { label: '😊 開心', q: 'happy' },
  { label: '👍 讚', q: 'thumbs up' },
  { label: '❤️ 愛心', q: 'love' },
  { label: '🎉 慶祝', q: 'celebrate' },
  { label: '💪 加油', q: 'you can do it' },
  { label: '😮 驚訝', q: 'wow' },
  { label: '🙏 謝謝', q: 'thank you' },
  { label: '😭 哭', q: 'crying' },
  { label: '🐱 貓', q: 'cat' },
  { label: '🐶 狗', q: 'dog' },
]

export function GifPicker({
  onSelect,
  giphyEndpoint = '/api/giphy',
}: {
  onSelect: (url: string) => void
  giphyEndpoint?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [q, setQ] = useState('')
  const [activeCat, setActiveCat] = useState(0)
  const [gifs, setGifs] = useState<Gif[]>([])
  const [state, setState] = useState<FetchState>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => setMounted(true), [])

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect()
    if (!b || typeof window === 'undefined') return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(PANEL_W, vw - 16)
    const left = Math.max(8, Math.min(b.left, vw - w - 8))
    const above = b.top > Math.min(400, vh - 80)
    setPos({ left, top: above ? b.top - 8 : b.bottom + 8, above })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open, gifs.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function fetchGifs(query: string, off: number) {
    setState('loading')
    try {
      const res = await fetch(`${giphyEndpoint}?q=${encodeURIComponent(query.trim())}&offset=${off}&limit=${PER_PAGE}`)
      if (res.status === 503) {
        setState('unconfigured')
        return
      }
      const body = (await res.json().catch(() => null)) as
        | { data?: { gifs: Gif[]; hasMore?: boolean }; error?: { message?: string } }
        | null
      if (!res.ok) {
        setErrMsg(body?.error?.message ?? null)
        setState('error')
        return
      }
      setGifs(body?.data?.gifs ?? [])
      setHasMore(Boolean(body?.data?.hasMore))
      setState('idle')
    } catch {
      setState('error')
    }
  }

  // 開啟時載熱門
  useEffect(() => {
    if (!open) return
    setActiveCat(0)
    setQ('')
    setOffset(0)
    void fetchGifs('', 0)
  }, [open])

  function onQ(v: string) {
    setQ(v)
    setActiveCat(-1)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setOffset(0)
      void fetchGifs(v, 0)
    }, 400)
  }
  function pickCat(i: number) {
    setActiveCat(i)
    setQ('')
    setOffset(0)
    void fetchGifs(CATS[i]!.q, 0)
  }
  function go(dir: 1 | -1) {
    const off = Math.max(0, offset + dir * PER_PAGE)
    setOffset(off)
    void fetchGifs(activeCat >= 0 ? CATS[activeCat]!.q : q, off)
  }

  const w = mounted ? Math.min(PANEL_W, window.innerWidth - 16) : PANEL_W

  const panel = open && pos && (
    <div
      ref={panelRef}
      className="sr-gif-panel"
      style={{ left: pos.left, top: pos.top, width: w, transform: pos.above ? 'translateY(-100%)' : undefined }}
      role="dialog"
      aria-label="GIF 選擇器"
    >
      {state === 'unconfigured' ? (
        <p className="sr-muted" style={{ margin: 0, textAlign: 'center' }}>Giphy 尚未設定（GIPHY_API_KEY）。</p>
      ) : (
        <>
          <input
            className="sr-input"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="搜尋 GIF…"
            autoFocus
            style={{ marginBottom: 'var(--sr-space-2)' }}
          />
          <div className="sr-gif-cats">
            {CATS.map((c, i) => (
              <button
                key={c.label}
                type="button"
                className={`sr-gif-cat${activeCat === i ? ' is-active' : ''}`}
                onClick={() => pickCat(i)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="sr-gif-scroll">
            {state === 'loading' ? (
              <p className="sr-muted" style={{ textAlign: 'center', margin: 'var(--sr-space-5) 0' }}>載入中…</p>
            ) : state === 'error' ? (
              <p className="sr-muted" style={{ textAlign: 'center', margin: 'var(--sr-space-5) 0' }}>{errMsg ?? '讀不到 GIF。'}</p>
            ) : gifs.length === 0 ? (
              <p className="sr-muted" style={{ textAlign: 'center', margin: 'var(--sr-space-5) 0' }}>找不到 GIF。</p>
            ) : (
              <div className="sr-gif-grid">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="sr-gif-cell"
                    title={g.title}
                    onClick={() => {
                      onSelect(g.url)
                      setOpen(false)
                    }}
                  >
                    <img src={g.url} alt={g.title || 'GIF'} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="sr-gif-foot">
            <button type="button" className="sr-linkish" onClick={() => go(-1)} disabled={offset === 0 || state === 'loading'}>
              ‹ 上一頁
            </button>
            <span className="sr-muted" style={{ fontSize: '10px' }}>Powered by GIPHY</span>
            <button type="button" className="sr-linkish" onClick={() => go(1)} disabled={!hasMore || state === 'loading'}>
              下一頁 ›
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      <button ref={btnRef} type="button" className="sr-rich-btn" onClick={() => setOpen((o) => !o)} title="GIF" aria-label="插入 GIF">
        GIF
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  )
}
