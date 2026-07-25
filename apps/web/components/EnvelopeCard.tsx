'use client'

import { useEffect, useState } from 'react'

/**
 * 信封卡：一開始是封好的信封，點一下 → 封蓋掀開 → 信紙從裡面升起、展開閱讀。
 * 生日當天在 Home 呈現。尊重 reduced-motion（直接展開、不做動畫）。
 */
export function EnvelopeCard({ title, lines }: { title: string; lines: string[] }) {
  const [stage, setStage] = useState<'sealed' | 'opening' | 'reading'>('sealed')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStage('reading')
    }
  }, [])

  function open() {
    if (stage !== 'sealed') return
    setStage('opening')
    // 封蓋先掀（~500ms），信紙再升起展開；約 1.1s 後進入可讀狀態
    window.setTimeout(() => setStage('reading'), 1100)
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
