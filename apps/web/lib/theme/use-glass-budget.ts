'use client'

import { useEffect } from 'react'
import { assignGlass, glassBudgetFor } from '@snowrealm/theme-engine'

/**
 * 把毛玻璃數量控制在預算內。實作 05-theme-tokens.md §2。
 *
 * backdrop-filter 每個都要對後方畫面取樣模糊，太多會掉幀。
 * 桌機同時最多 12 個、行動 6 個，超過的降級為 solid。
 *
 * ## 為什麼用 IntersectionObserver
 *
 * 規格說「非視窗內的 widget 自動降級」。所以優先保留**看得見**的 widget
 * 的毛玻璃 —— 捲到看不見的降級不影響觀感，卻省下模糊成本。
 * observer 回報每個 slot 的可見性，可見的 priority 小（優先保留）。
 *
 * 降級方式是在 slot 上設 `data-glass="off"`，CSS 據此把 `.sr-card`
 * 改成不透明背景、拿掉 backdrop-filter。
 */
export function useGlassBudget(
  containerRef: React.RefObject<HTMLElement | null>,
  breakpoint: string,
  itemCount: number,
): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const budget = glassBudgetFor(breakpoint)

    // 目前每個 slot 的可見比例。observer 更新後重算分配。
    const visibility = new Map<Element, number>()

    const apply = () => {
      const slots = Array.from(container.querySelectorAll<HTMLElement>('.sr-widget-slot'))
      if (slots.length === 0) return

      // priority 越小越優先保留毛玻璃 → 可見度高的 priority 小。
      // 用 (1 - 可見比例) 當 priority，完全可見=0，完全看不見=1。
      const priorities = slots.map((slot) => 1 - (visibility.get(slot) ?? 0))
      const glass = assignGlass(priorities, budget)

      slots.forEach((slot, index) => {
        // 只有真的需要降級時才設屬性，避免無謂的 DOM 變動
        if (glass[index]) slot.removeAttribute('data-glass')
        else slot.setAttribute('data-glass', 'off')
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target, entry.intersectionRatio)
        }
        apply()
      },
      // 多個門檻，讓部分可見的 widget 也有合理的可見比例
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    const slots = container.querySelectorAll('.sr-widget-slot')
    slots.forEach((slot) => observer.observe(slot))

    // 首次同步一次（observer 的第一次回呼可能稍晚）
    apply()

    return () => observer.disconnect()
    // itemCount 變動時（新增/移除 widget）要重新掛 observer
  }, [containerRef, breakpoint, itemCount])
}
