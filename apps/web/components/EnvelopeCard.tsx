'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 信封卡：一開始是封好的信封，點一下 → 封蓋掀開 → 信紙從裡面升起、展開閱讀。
 * 生日當天在 Home 呈現；驚喜收藏頁則常駐，任何一天都能重看與保存。
 * 尊重 reduced-motion（直接展開、不做動畫）。
 *
 * 「保存」＝把卡片畫成圖片下載到裝置（純 canvas，不依賴外部套件），使用者能永久留著。
 */
export function EnvelopeCard({
  title,
  lines,
  savable = false,
  collectable = false,
  spaceId,
}: {
  title: string
  lines: string[]
  /** 顯示「再看一次／保存成圖片」。常駐版（驚喜收藏）開啟；Home 當天版預設關閉。 */
  savable?: boolean
  /** 顯示「收進驚喜收藏」——壽星在 Home 親手收藏，收完這張卡改於驚喜收藏頁常駐。 */
  collectable?: boolean
  /** collectable 時必填：呼叫收藏 API 用的 x-space-id。 */
  spaceId?: string
}) {
  const [stage, setStage] = useState<'sealed' | 'opening' | 'reading'>('sealed')
  const [saved, setSaved] = useState(false)
  const [collected, setCollected] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStage('reading')
    }
    return () => window.clearTimeout(timer.current)
  }, [])

  function open() {
    if (stage !== 'sealed') return
    setStage('opening')
    // 封蓋先掀（~500ms），信紙再升起展開；約 1.1s 後進入可讀狀態
    timer.current = window.setTimeout(() => setStage('reading'), 1100)
  }

  function reseal() {
    window.clearTimeout(timer.current)
    setStage('sealed')
  }

  async function collect() {
    if (!spaceId || collecting || collected) return
    setCollecting(true)
    try {
      const res = await fetch('/api/birthday-card/collect', {
        method: 'POST',
        headers: { 'x-space-id': spaceId },
      })
      if (res.ok) setCollected(true)
    } finally {
      setCollecting(false)
    }
  }

  function save() {
    try {
      const url = renderCardPng(title, lines)
      const a = document.createElement('a')
      a.href = url
      a.download = '生日卡.png'
      a.click()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2400)
    } catch {
      /* canvas 不可用時靜默 —— 卡片本身仍在畫面上 */
    }
  }

  return (
    <div className="sr-env" data-stage={stage}>
      {/* 信紙（升起後就是內容卡） */}
      <article className="sr-env-letter sr-card" aria-hidden={stage === 'sealed'}>
        <span className="sr-env-ribbon" aria-hidden="true" />
        <h2 className="sr-env-title">{title}</h2>
        {lines.map((l, i) => (
          <p key={i} className="sr-env-line">
            {l}
          </p>
        ))}

        {stage === 'reading' && (savable || collectable) && (
          <>
            {collected && (
              <p className="sr-env-collected" role="status">
                已收進驚喜收藏 💝 之後在「驚喜收藏」隨時再打開。
              </p>
            )}
            <div className="sr-env-actions">
              <button type="button" className="sr-button sr-button-secondary" onClick={reseal}>
                再看一次 ✉️
              </button>
              {savable && (
                <button type="button" className="sr-button sr-button-secondary" onClick={save}>
                  {saved ? '已保存 ✓' : '保存成圖片'}
                </button>
              )}
              {collectable && !collected && (
                <button type="button" className="sr-button" onClick={() => void collect()} disabled={collecting}>
                  {collecting ? '收藏中…' : '收進驚喜收藏 💝'}
                </button>
              )}
            </div>
          </>
        )}
      </article>

      {/* 信封本體（掀蓋 + 蠟封）。可讀後淡出（CSS 依 data-stage）。 */}
      <button
        type="button"
        className="sr-env-envelope"
        onClick={open}
        aria-label="打開生日卡片"
        disabled={stage !== 'sealed'}
        tabIndex={stage === 'reading' ? -1 : 0}
      >
        <span className="sr-env-flap" aria-hidden="true" />
        <span className="sr-env-body" aria-hidden="true" />
        <span className="sr-env-seal" aria-hidden="true">✿</span>
        {stage === 'sealed' && <span className="sr-env-hint">點我打開 ✉️</span>}
      </button>
    </div>
  )
}

/** 把卡片畫成一張溫暖的粉色圖片，回傳 data URL。純 canvas、無外部依賴。 */
function renderCardPng(title: string, lines: string[]): string {
  const scale = 2
  const W = 720
  const padX = 72
  const padTop = 96
  const padBottom = 80
  const titleFont = '700 42px "Noto Sans TC", system-ui, sans-serif'
  const lineFont = '400 27px "Noto Sans TC", system-ui, sans-serif'
  const lineGap = 44
  const maxTextW = W - padX * 2

  // 先用離屏 context 量測換行
  const meas = document.createElement('canvas').getContext('2d')
  if (!meas) throw new Error('no canvas')
  meas.font = lineFont
  const wrapped: string[] = []
  for (const raw of lines) {
    let cur = ''
    for (const ch of raw) {
      if (meas.measureText(cur + ch).width > maxTextW && cur) {
        wrapped.push(cur)
        cur = ch
      } else {
        cur += ch
      }
    }
    wrapped.push(cur)
  }

  const titleH = 56
  const bodyH = wrapped.length * lineGap
  const H = padTop + titleH + 28 + bodyH + padBottom

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.scale(scale, scale)

  // 背景漸層
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#fff7fb')
  g.addColorStop(1, '#ffe6f0')
  roundRect(ctx, 0, 0, W, H, 28)
  ctx.fillStyle = g
  ctx.fill()

  // 邊框
  roundRect(ctx, 6, 6, W - 12, H - 12, 22)
  ctx.strokeStyle = '#f3a7c3'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'

  // 花封
  ctx.font = '40px system-ui, sans-serif'
  ctx.fillStyle = '#e58bb0'
  ctx.fillText('✿', W / 2, 60)

  // 標題
  ctx.font = titleFont
  ctx.fillStyle = '#7a3b55'
  ctx.fillText(title, W / 2, padTop + 24)

  // 內文
  ctx.font = lineFont
  ctx.fillStyle = '#5a3444'
  let y = padTop + titleH + 40
  for (const l of wrapped) {
    ctx.fillText(l, W / 2, y)
    y += lineGap
  }

  // 落款
  ctx.font = '400 20px "Noto Sans TC", system-ui, sans-serif'
  ctx.fillStyle = '#c98aa6'
  ctx.fillText('— SnowRealm Space', W / 2, H - 42)

  return canvas.toDataURL('image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
