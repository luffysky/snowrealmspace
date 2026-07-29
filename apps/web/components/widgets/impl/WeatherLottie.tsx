'use client'

import { useEffect, useRef } from 'react'
import type { WeatherCondition } from '@snowrealm/validation'
import { weatherIconName, loadWeatherIconData } from '@/lib/weather-lottie'

/**
 * 天氣 Meteocons 動畫圖示（取代原本的 ☀/☾ emoji）。
 *
 * lottie-web（light 版）與圖示 JSON 都懶載入 —— 不進主 bundle，只有真的顯示才拉。
 * 無障礙/效能：reduced-motion 或省流量 → 只停在第一格（仍看得到圖，不動，不自動播放）。
 * 誠實 fallback：JSON 載入失敗就什麼都不畫（回 null 由呼叫端決定），不讓元件崩掉。
 */
export function WeatherLottie({
  condition,
  isDay,
  size = 44,
}: {
  condition: WeatherCondition
  isDay: boolean
  size?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const name = weatherIconName(condition, isDay)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let anim: {
      goToAndStop(v: number, isFrame?: boolean): void
      destroy(): void
    } | null = null

    // 與 LottieBackground 相同的判斷：reduced-motion 或省流量 → 靜態第一格
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const saveData =
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
    const staticOnly = reduce || saveData

    void (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import('lottie-web/build/player/lottie_light'),
        loadWeatherIconData(name),
      ])
      // 載入失敗（data 為 null）→ 誠實不畫，不崩潰
      if (cancelled || !data || !containerRef.current) return
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: !staticOnly,
        autoplay: !staticOnly,
        animationData: data as object,
      })
      if (staticOnly) anim.goToAndStop(0, true)
    })()

    // 卸載 / condition 變更時清掉動畫實例
    return () => {
      cancelled = true
      if (anim) anim.destroy()
    }
  }, [name])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ width: size, height: size, flexShrink: 0, maxWidth: '100%' }}
    />
  )
}
