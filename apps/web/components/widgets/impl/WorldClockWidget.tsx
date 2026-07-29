'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 世界時鐘：最多四個時區，各以可讀標籤選擇，逐分走針。
 *
 * 設定存的是可讀標籤（enum，見 registry），這裡用 ZONES 對照到 IANA 時區；
 * '—（不顯示）' 對到 null → 該列略過。時間用 Intl 依 timeZone 換算，全部瀏覽器內建、不連網。
 *
 * SSR/hydration：時間每秒在變，server 沒有穩定的「現在」——
 * 故 now 初始 null，只在 client 掛載後才有值（見 DateTimeWidget 檔頭）。
 */

type ZoneLabel =
  | '台北' | '東京' | '首爾' | '上海' | '曼谷' | '新加坡'
  | '倫敦' | '巴黎' | '紐約' | '洛杉磯' | '雪梨' | '杜拜' | '—（不顯示）'

type Cfg = {
  zone1?: ZoneLabel
  zone2?: ZoneLabel
  zone3?: ZoneLabel
  zone4?: ZoneLabel
  use24h?: boolean
}

// 可讀標籤 → IANA 時區；'—（不顯示）' → null（不顯示該列）。
const ZONES: Record<ZoneLabel, string | null> = {
  台北: 'Asia/Taipei',
  東京: 'Asia/Tokyo',
  首爾: 'Asia/Seoul',
  上海: 'Asia/Shanghai',
  曼谷: 'Asia/Bangkok',
  新加坡: 'Asia/Singapore',
  倫敦: 'Europe/London',
  巴黎: 'Europe/Paris',
  紐約: 'America/New_York',
  洛杉磯: 'America/Los_Angeles',
  雪梨: 'Australia/Sydney',
  杜拜: 'Asia/Dubai',
  '—（不顯示）': null,
}

function formatInZone(date: Date, timeZone: string, use24h: boolean): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24h,
    }).format(date)
  } catch {
    return '—'
  }
}

export default function WorldClockWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const use24h = cfg.use24h ?? true
  const labels: ZoneLabel[] = [cfg.zone1 ?? '台北', cfg.zone2 ?? '—（不顯示）', cfg.zone3 ?? '—（不顯示）', cfg.zone4 ?? '—（不顯示）']

  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 只保留有對到 IANA 時區的列（略過 '—（不顯示）' 與未知標籤）。
  const rows = labels
    .map((label) => ({ label, zone: ZONES[label] ?? null }))
    .filter((r): r is { label: ZoneLabel; zone: string } => r.zone !== null)

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title">世界時鐘</h3>

      {rows.length === 0 ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          到設定選要顯示的時區。
        </p>
      ) : !now ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          {rows.map((r) => (
            <div
              key={r.label}
              className="sr-row"
              style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)', minWidth: 0 }}
            >
              <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{r.label}</span>
              <span
                style={{
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatInZone(now, r.zone, use24h)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
