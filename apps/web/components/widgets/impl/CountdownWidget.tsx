'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 倒數計時：距離設定的「目標日期」還有幾天。
 *
 * 目標當成當地午夜。未來 → 「還有 N 天」；可選顯示到時分（逐秒走針）。
 * 目標當天 → 「已經到了 🎉」；已過 → 「已過 N 天」。全部當地時間、不連網。
 *
 * SSR/hydration：now 每秒在變，server 沒有穩定的「現在」——
 * 故 now 初始 null，只在 client 掛載後才有值（見 DateTimeWidget 檔頭）。
 * showTime 時每秒 tick，否則每分鐘 tick 就夠。
 */

type Cfg = {
  title?: string
  targetDate?: string
  showTime?: boolean
}

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' → 當地午夜的 Date；格式不符回 null。 */
function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
  } catch {
    return ''
  }
}

export default function CountdownWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const title = cfg.title || '倒數'
  const targetDate = cfg.targetDate ?? ''
  const showTime = cfg.showTime ?? false

  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), showTime ? 1000 : 60_000)
    return () => clearInterval(id)
  }, [showTime])

  const target = parseDateOnly(targetDate)

  let body: React.ReactNode
  if (!target) {
    body = (
      <p className="sr-muted" style={{ margin: 0 }}>
        到設定選一個目標日期。
      </p>
    )
  } else if (!now) {
    body = (
      <p className="sr-muted" style={{ margin: 0 }}>
        載入中…
      </p>
    )
  } else {
    const remaining = target.getTime() - now.getTime()
    // 今天當地午夜，用來判斷「目標是不是今天」與「已過幾天」。
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const dayDiff = Math.round((target.getTime() - todayMidnight) / MS_PER_DAY)

    let main: string
    let sub: string | null = null
    if (dayDiff > 0) {
      main = `還有 ${dayDiff} 天`
      if (showTime && remaining > 0) {
        const hours = Math.floor((remaining % MS_PER_DAY) / 3_600_000)
        const mins = Math.floor((remaining % 3_600_000) / 60_000)
        sub = `${hours} 小時 ${mins} 分`
      }
    } else if (dayDiff === 0) {
      main = '已經到了 🎉'
    } else {
      main = `已過 ${-dayDiff} 天`
    }

    body = (
      <>
        <div
          style={{
            fontSize: 'var(--sr-text-h1)',
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {main}
        </div>
        {sub && (
          <div className="sr-muted" style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
            {sub}
          </div>
        )}
        <p className="sr-muted" style={{ margin: 'var(--sr-space-1) 0 0', minWidth: 0, overflowWrap: 'anywhere' }}>
          {formatDate(target)}
        </p>
      </>
    )
  }

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
        {title}
      </h3>
      {body}
    </div>
  )
}
