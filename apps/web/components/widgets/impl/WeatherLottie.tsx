'use client'

import { useEffect, useRef } from 'react'
import type { WeatherCondition } from '@snowrealm/validation'
import { weatherIconName, loadWeatherIconData } from '@/lib/weather-lottie'

/**
 * 天氣動畫圖示（jochang Lottie，取代原本的 ☀/☾ emoji）。
 *
 * lottie-web（light 版）與圖示 JSON 都懶載入 —— 不進主 bundle，只有真的顯示才拉。
 * **一律播放**：這是小小的、使用者主動開的功能性圖示，不套用背景那種 reduced-motion 靜止
 * （否則系統關動畫的人會看到「不會動的天氣」，正是回報的症狀）。大面積背景動畫仍另外尊重
 * reduced-motion。誠實 fallback：JSON 載入失敗就什麼都不畫（回 null 由呼叫端決定），不讓元件崩掉。
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
    let anim: { destroy(): void; setSpeed?(speed: number): void } | null = null

    void (async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import('lottie-web/build/player/lottie_light'),
        loadWeatherIconData(name),
      ])
      // 載入失敗（data 為 null）→ 誠實不畫，不崩潰
      if (cancelled || !data || !containerRef.current) return
      // 天氣圖示一律自動播放並循環（見上方註解：不套用 reduced-motion 靜止）。
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: data as object,
      })
      // 稍微加速：小尺寸下多雲/晴這類溫和天氣的動態很難察覺，加速後更明顯。
      anim.setSpeed?.(1.4)
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
