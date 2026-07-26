'use client'

import { useState } from 'react'
import { notoWebp, emojiToNotoCode, fluentPng } from './emoji-assets'

/**
 * 動態 emoji（移植自 AI 島）。三段式 fallback：
 *   1) Noto Animated WebP（會動）
 *   2) Fluent 3D（靜態立體）
 *   3) 作業系統純字元
 * 只是一張 <img>，每段載失敗自動往下退。`play=false` 直接用純字元（省資源）。
 */
export function AnimatedEmoji({
  emoji,
  size = 24,
  play = true,
  title,
}: {
  emoji: string
  size?: number
  play?: boolean
  title?: string
}) {
  const [stage, setStage] = useState(0) // 0=Noto 1=Fluent 2=字元
  const code = emojiToNotoCode(emoji)

  if (!code || !play || stage >= 2) {
    return (
      <span
        style={{ fontSize: size * 0.9, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
        role="img"
        aria-label={title ?? emoji}
        title={title}
      >
        {emoji}
      </span>
    )
  }

  const src = stage === 0 ? notoWebp(code) : fluentPng(emoji)
  return (
    <img
      key={stage}
      src={src}
      alt={title ?? emoji}
      title={title}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setStage((s) => s + 1)}
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle', userSelect: 'none' }}
      draggable={false}
    />
  )
}
