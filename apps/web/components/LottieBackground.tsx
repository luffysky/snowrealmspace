'use client'

import { useEffect, useRef } from 'react'
import { getLottieScene, loadLottieData } from '@/lib/lottie-scenes'

/**
 * 內建 Lottie 向量動畫背景。lottie-web（light 版）懶載入 —— 只有真的用到 Lottie 背景
 * 才會拉這包，不進主 bundle。
 *
 * 無障礙/效能：reduced-motion 或省流量 → 只停在第一格（仍看得到圖，不動）；
 * paused（例如背景暫停鈕）→ 暫停播放。動畫底透明，鋪在建議底色上。
 */
export function LottieBackground({
  lottieId,
  paused = false,
}: {
  lottieId: string | null
  paused?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  const scene = getLottieScene(lottieId)

  // 播放/暫停：不重建動畫，只切狀態
  const animRef = useRef<{ play(): void; pause(): void } | null>(null)
  useEffect(() => {
    pausedRef.current = paused
    if (animRef.current) paused ? animRef.current.pause() : animRef.current.play()
  }, [paused])

  useEffect(() => {
    if (!lottieId || !scene) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let anim: {
      play(): void
      pause(): void
      goToAndStop(v: number, isFrame?: boolean): void
      destroy(): void
    } | null = null

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const saveData =
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
    const staticOnly = reduce || saveData

    ;(async () => {
      const [{ default: lottie }, data] = await Promise.all([
        import('lottie-web/build/player/lottie_light'),
        loadLottieData(lottieId),
      ])
      if (cancelled || !data || !containerRef.current) return
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: !staticOnly,
        autoplay: !staticOnly && !pausedRef.current,
        animationData: data as object,
        rendererSettings: { preserveAspectRatio: 'xMidYMid slice' },
      })
      animRef.current = anim
      if (staticOnly) anim.goToAndStop(0, true)
      else if (pausedRef.current) anim.pause()
    })()

    return () => {
      cancelled = true
      animRef.current = null
      if (anim) anim.destroy()
    }
  }, [lottieId, scene])

  if (!scene) return null

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, background: scene.bg, overflow: 'hidden' }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
