'use client'

import { Fragment } from 'react'
import { AnimatedEmoji } from './AnimatedEmoji'

/**
 * 把純文字裡的 emoji 換成動畫版（Noto animated webp）——渲染時做，不改存的資料。
 *
 * 這是「送出後表情還是動畫」的關鍵：訊息只存純 unicode（好編輯、好退格），
 * 顯示端再把每個 emoji 叢集換成 <AnimatedEmoji>（webp → Fluent 3D → OS 字元三段
 * fallback）。作法照搬 AI 島的 EmojiText。文字部分原樣輸出（換行交給 CSS pre-wrap）。
 */

// 一個 emoji 叢集：起始的 Extended_Pictographic + 後續 ZWJ(200D) 連接、變異選擇子(FE0F)、膚色。
const CLUSTER =
  '\\p{Extended_Pictographic}(?:\\u200D\\p{Extended_Pictographic}|\\uFE0F|\\u{1F3FB}|\\u{1F3FC}|\\u{1F3FD}|\\u{1F3FE}|\\u{1F3FF})*'
const EMOJI_SPLIT = new RegExp(`(${CLUSTER})`, 'gu')
const IS_EMOJI = new RegExp(`^${CLUSTER}$`, 'u')

export function EmojiText({ text, size = 18 }: { text: string; size?: number }) {
  if (!text) return null
  const parts = text.split(EMOJI_SPLIT)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (IS_EMOJI.test(part)) return <AnimatedEmoji key={i} emoji={part} size={size} />
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
