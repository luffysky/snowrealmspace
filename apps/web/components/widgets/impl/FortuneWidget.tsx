'use client'

import { useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 幸運籤：按「抽一支」隨機顯示一句。自訂籤詩一行一句；留空用內建溫柔籤。
 * 純前端、不落地、不連網 —— 每次抽都是即時隨機（同一句可能連抽到）。
 */

type Cfg = { fortunes?: string }

const DEFAULT_FORTUNES = [
  '今天會有一件小小的好事發生。',
  '你值得被溫柔對待，包括對自己。',
  '慢慢來，你已經走在對的路上了。',
  '深呼吸，這一刻你是安全的。',
  '有人正在默默替你加油。',
  '把難的事拆小，一步就好。',
  '你比自己想的更堅強。',
  '今天適合對自己說聲謝謝。',
  '好運正在來的路上，別急。',
  '記得抬頭看看天空，喘口氣。',
]

function parseFortunes(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export default function FortuneWidget({ config }: WidgetProps) {
  const custom = parseFortunes((config as Cfg | null)?.fortunes ?? '')
  const list = custom.length > 0 ? custom : DEFAULT_FORTUNES

  const [fortune, setFortune] = useState<string | null>(null)

  function draw() {
    setFortune(list[Math.floor(Math.random() * list.length)] ?? null)
  }

  return (
    <div className="sr-card sr-widget" style={{ textAlign: 'center', minWidth: 0 }}>
      <h3 className="sr-widget-title">幸運籤</h3>

      <p
        style={{
          margin: 'var(--sr-space-2) 0',
          fontSize: 'var(--sr-text-lg)',
          lineHeight: 1.6,
          minHeight: '2.6em',
          overflowWrap: 'anywhere',
        }}
        aria-live="polite"
      >
        {fortune ?? '按下面抽一支吧。'}
      </p>

      <button type="button" className="sr-button" onClick={draw}>
        抽一支
      </button>
    </div>
  )
}
