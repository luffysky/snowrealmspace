'use client'

import { useEffect, useMemo, useState } from 'react'
import { validateSlots, uncoveredHours, type Slot } from '@snowrealm/validation'

/**
 * time_of_day 排程的設定介面。v1.0 §12.7。
 *
 * resolver 與 schema 早就完成了，一直缺的就是這個介面 ——
 * 使用者無法設定「早上用這張、晚上用那張」。
 *
 * ## 兩個刻意的設計
 *
 * 1. **重疊即時擋下並說明**，而不是存了才發現。重疊時哪張生效
 *    取決於陣列順序，使用者看不出來，等於隱形的隨機行為。
 *
 * 2. **明確列出沒設定的時段**。留白的時間會退回第一張背景，
 *    如果不說，使用者會以為排程壞了。
 */

type BackgroundOption = { id: string; label: string }

export function ScheduleEditor({
  slots: slotsProp,
  backgrounds,
  onChange,
}: {
  slots: Slot[]
  backgrounds: BackgroundOption[]
  onChange: (slots: Slot[]) => void
}) {
  const [error, setError] = useState<string | null>(null)

  /*
   * 本地工作副本。編輯必須是同步的：
   * 若每次改動都要等伺服器來回，下一次改動會讀到還沒更新的舊值，
   * 產生競態（重疊偵測會漏掉、剛加的時段會消失）。
   * 這裡持有本地狀態，只在**有效**時才往上送去持久化。
   */
  const [slots, setSlots] = useState<Slot[]>(slotsProp)

  // 外部（另一次儲存、reload）帶來的變更才同步進本地副本。
  //
  // deps 只放序列化後的 propKey，**不可**放 slotsProp 本身：
  // 父層每次 render 都會產生一個新的 `[]` 陣列參考（schedule 為 null 時），
  // 把 slotsProp 放進 deps 會讓這個 effect 每次 render 都執行，
  // 於是使用者剛編輯的本地狀態被空陣列蓋掉 —— 改了就沒。
  const propKey = JSON.stringify(slotsProp)
  useEffect(() => {
    setSlots(JSON.parse(propKey) as Slot[])
    setError(null)
  }, [propKey])

  const uncovered = useMemo(() => uncoveredHours(slots), [slots])

  function commit(next: Slot[]) {
    // 本地一律先反映出來，使用者才看得到自己改了什麼
    setSlots(next)

    const check = validateSlots(next)
    if (!check.ok) {
      setError(check.message)
      return
    }
    setError(null)
    onChange(next)
  }

  function addSlot() {
    // 找一段還沒被佔用的時間當預設，避免一加就重疊
    const free = uncovered[0] ?? 0
    const first = backgrounds[0]
    if (!first) return
    commit([
      ...slots,
      { startHour: free, endHour: (free + 4) % 24 || 24, backgroundItemId: first.id },
    ])
  }

  function updateSlot(index: number, patch: Partial<Slot>) {
    commit(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeSlot(index: number) {
    commit(slots.filter((_, i) => i !== index))
  }

  return (
    <div className="sr-schedule">
      {error && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {error}
        </p>
      )}

      {slots.length === 0 ? (
        <p className="sr-muted">還沒有時段。加一個來決定不同時間顯示哪張背景。</p>
      ) : (
        <ul className="sr-schedule-slots" role="list">
          {slots.map((slot, index) => (
            <li key={index} className="sr-schedule-slot">
              <HourSelect
                label="從"
                value={slot.startHour}
                max={23}
                onChange={(v) => updateSlot(index, { startHour: v })}
              />
              <HourSelect
                label="到"
                value={slot.endHour}
                max={24}
                onChange={(v) => updateSlot(index, { endHour: v })}
              />
              <select
                className="sr-input"
                aria-label={`第 ${index + 1} 個時段的背景`}
                value={slot.backgroundItemId}
                onChange={(e) => updateSlot(index, { backgroundItemId: e.target.value })}
              >
                {backgrounds.map((bg) => (
                  <option key={bg.id} value={bg.id}>
                    {bg.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="sr-asset-delete"
                onClick={() => removeSlot(index)}
                aria-label={`刪除第 ${index + 1} 個時段`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="sr-button sr-button-secondary"
        onClick={addSlot}
        disabled={backgrounds.length === 0 || slots.length >= 8}
      >
        新增時段
      </button>

      {uncovered.length > 0 && slots.length > 0 && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)' }}>
          沒設定的時段（{formatHourList(uncovered)}）會顯示清單的第一張背景。
        </p>
      )}
    </div>
  )
}

function HourSelect({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="sr-schedule-hour">
      <span className="sr-muted">{label}</span>
      <select
        className="sr-input"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {Array.from({ length: max + 1 }, (_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, '0')}:00
          </option>
        ))}
      </select>
    </label>
  )
}

/** 把連續的小時壓成區間顯示，例如 [0,1,2,18,19] → "00–02、18–19"。 */
function formatHourList(hours: number[]): string {
  if (hours.length === 0) return ''
  const sorted = [...hours].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]!
  let prev = start

  for (const h of sorted.slice(1)) {
    if (h === prev + 1) {
      prev = h
      continue
    }
    ranges.push(formatRange(start, prev))
    start = h
    prev = h
  }
  ranges.push(formatRange(start, prev))
  return ranges.join('、')
}

function formatRange(start: number, end: number): string {
  const h = (n: number) => `${String(n).padStart(2, '0')}`
  return start === end ? `${h(start)} 時` : `${h(start)}–${h(end)} 時`
}
