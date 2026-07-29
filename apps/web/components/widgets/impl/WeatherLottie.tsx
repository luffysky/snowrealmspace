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
  // number → px；string → 任意 CSS 長度（例如 clamp(...cqi...)，讓圖示隨 widget 放大）
  size?: number | string
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

  // 圖示後面的半透明「天空」背景（純 CSS，依天氣情境）：
  // 晴天日＝暖色日出/日落光暈＋天空；夜晚＝星空；雨/雷/毛毛雨＝大片烏雲；其餘＝淡淡柔光。
  const sky =
    condition === 'rain' ||
    condition === 'drizzle' ||
    condition === 'thunder' ||
    condition === 'typhoon'
      ? 'storm'
      : !isDay
        ? 'night'
        : condition === 'clear'
          ? 'sun'
          : 'soft'

  return (
    <div className="sr-weather-icon" style={{ width: size, height: size }}>
      <span className={`sr-weather-sky sr-weather-sky-${sky}`} aria-hidden="true" />
      <div
        ref={containerRef}
        aria-hidden="true"
        className="sr-weather-icon-lottie"
        style={{ width: size, height: size }}
      />
    </div>
  )
}
