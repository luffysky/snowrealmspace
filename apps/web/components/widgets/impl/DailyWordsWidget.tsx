'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 每日情話：一行一句自己寫，依「今天是第幾天」挑一句 ——
 * 同一天永遠是同一句，換天才換（index = 當地日序 % 句數）。
 * 沒有自訂句子時顯示幾句內建的溫柔預設。純瀏覽器、不連網。
 *
 * SSR/hydration：挑哪一句依「今天」而定，server 沒有穩定的「現在」——
 * 故 dayIndex 初始 null，只在 client 掛載後才計算（見 DateTimeWidget 檔頭）。
 */

type Cfg = {
  title?: string
  phrases?: string
}

const MS_PER_DAY = 86_400_000

const DEFAULT_PHRASES = [
  '今天也要好好的喔。',
  '你已經做得很好了。',
  '慢慢來，我在這裡。',
  '謝謝你今天也努力了。',
  '記得對自己溫柔一點。',
]

export default function DailyWordsWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const title = cfg.title || '每日情話'

  const custom = (cfg.phrases ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const phrases = custom.length > 0 ? custom : DEFAULT_PHRASES

  // 當地日序（自 epoch 起算的天數），掛載後才算 —— 避免 hydration mismatch。
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  useEffect(() => {
    const now = new Date()
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    setDayIndex(Math.floor(localMidnight / MS_PER_DAY))
  }, [])

  const phrase =
    dayIndex === null ? null : phrases[((dayIndex % phrases.length) + phrases.length) % phrases.length]

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
        {title}
      </h3>
      {phrase === null ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--sr-text-lg, 1.15rem)',
            lineHeight: 1.5,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {phrase}
        </p>
      )}
      {custom.length === 0 && phrase !== null && (
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0' }}>
          到設定寫下自己的句子，一行一句。
        </p>
      )}
    </div>
  )
}
