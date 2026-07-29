'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 紀念日：從設定的「起算日」算到今天已經幾天。
 *
 * 日期只算到「日」（忽略時間）：起算日與今天都當成當地午夜，兩者相差的整數天。
 * 過去 → 「已經 N 天」；今天 → 「就是今天」；未來 → 「還有 N 天」。
 * 全部用當地時間、不連網。
 *
 * SSR/hydration：今天是每天在變的值，server 沒有穩定的「現在」——
 * 在 server 就算會與 client 補水結果不一致。故 today 初始為 null，
 * 只在 client 掛載後才有值（見 DateTimeWidget 檔頭同樣理由）。
 */

type Cfg = {
  title?: string
  sinceDate?: string
  showDays?: boolean
}

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' → 當地午夜的 Date。格式不符回 null（用 new Date(y,m,d) 避免被當 UTC）。 */
function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/** 兩個「當地午夜」相差的整數天（用 round 吸收 DST 造成的幾小時誤差）。 */
function wholeDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
  } catch {
    return ''
  }
}

export default function AnniversaryWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const title = cfg.title || '紀念日'
  const sinceDate = cfg.sinceDate ?? ''
  const showDays = cfg.showDays ?? true

  // null 直到 client 首次掛載 —— 避免 SSR/hydration mismatch。
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => {
    const now = new Date()
    setToday(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  }, [])

  const since = parseDateOnly(sinceDate)

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
        {title}
      </h3>

      {!since ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          到設定選一個日子。
        </p>
      ) : !today ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      ) : (
        <>
          {showDays && (
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
              {(() => {
                const diff = wholeDaysBetween(since, today)
                if (diff === 0) return '就是今天'
                if (diff > 0) return `已經 ${diff} 天`
                return `還有 ${-diff} 天`
              })()}
            </div>
          )}
          <p
            className="sr-muted"
            style={{ margin: 'var(--sr-space-1) 0 0', minWidth: 0, overflowWrap: 'anywhere' }}
          >
            {formatDate(since)}
          </p>
        </>
      )}
    </div>
  )
}
