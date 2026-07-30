import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * ADR-019 / WCAG 2.2 Pause, Stop, Hide：影片背景必須有「使用者可見、可點」的暫停控制。
 *
 * 這個保證的真正實作在 BackgroundLayer 的 PausePortal（不是任何 widget 的 config）。
 * 以前是靠 background_control widget 的 allowPause 設定「宣稱」有暫停，但那個欄位
 * 從來沒被讀 —— 是假保證。移除後，改由這個測試盯住真實控制項還在。
 *
 * 變異測試：把 BackgroundLayer 的 PausePortal 或 setPaused 拿掉，這個測試就會紅。
 */

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(
  resolve(here, '../../components/BackgroundLayer.tsx'),
  'utf8',
)

describe('ADR-019：影片背景的暫停控制（PausePortal）', () => {
  it('BackgroundLayer 有可切換的暫停控制元件', () => {
    expect(source).toMatch(/function PausePortal/)
    expect(source).toMatch(/<PausePortal[\s\S]*onToggle=/)
    expect(source).toMatch(/setPaused/)
  })

  it('影片依 paused 狀態實際暫停播放', () => {
    // effect 裡必須真的呼叫 video.pause()（而不是只切 state 卻不作用）
    expect(source).toMatch(/video\.pause\(\)/)
  })

  it('reduced-motion / 省流量時影片降級為靜態幀', () => {
    expect(source).toMatch(/degradeVideo/)
  })
})
