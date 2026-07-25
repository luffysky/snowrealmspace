import { useEffect } from 'react'

/**
 * 鎖住背景捲動（手機抽屜/對話框開啟時）。
 *
 * 單純 `overflow:hidden` 在行動瀏覽器擋不住 touch 捲動 —— 背景還是會跟著滑。
 * 用 `position:fixed` + 記住 scrollY 才真的鎖住；關閉時還原並跳回原位。
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    const body = document.body
    const y = window.scrollY
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, y)
    }
  }, [locked])
}
