'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { getTour, type Tour } from './tours'

const EVT = 'sr:start-tutorial'

/** 從任何地方啟動教學（footer、使用說明頁都用這個）。 */
export function startTutorial(id: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVT, { detail: id }))
  }
}

/**
 * 教學主機：掛在 root layout，監聽啟動事件後，一步步導覽——導到對應頁面、
 * 把目標區塊打亮（其餘暗化）、顯示解說。可上一步/下一步/略過。
 * 目標選不到時退化成置中解說，不會卡住。
 */
export function TutorialHost() {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [tour, setTour] = useState<Tour | null>(null)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onStart = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const t = getTour(id)
      if (t) {
        setTour(t)
        setStep(0)
        setRect(null)
      }
    }
    window.addEventListener(EVT, onStart)
    return () => window.removeEventListener(EVT, onStart)
  }, [])

  const current = tour?.steps[step] ?? null

  // 需要換頁就先導覽過去
  useEffect(() => {
    if (current?.route && pathname !== current.route) router.push(current.route)
  }, [current, pathname, router])

  // 找目標元素、算出打亮框（找不到就輪詢一小段時間，逾時退化為置中）
  useEffect(() => {
    setRect(null)
    if (!current?.selector) return
    if (current.route && pathname !== current.route) return

    let raf = 0
    let tries = 0
    let cancelled = false
    const find = () => {
      if (cancelled) return
      const el = document.querySelector(current.selector!)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect())
        }, 320)
        return
      }
      if (tries++ < 50) raf = requestAnimationFrame(find)
    }
    find()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [current, pathname])

  // 捲動/縮放時重算打亮框
  useEffect(() => {
    if (!current?.selector) return
    const recompute = () => {
      const el = document.querySelector(current.selector!)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [current])

  if (!mounted || !tour || !current) return null

  const close = () => {
    setTour(null)
    setStep(0)
    setRect(null)
  }
  const next = () => (step + 1 < tour.steps.length ? setStep(step + 1) : close())
  const prev = () => step > 0 && setStep(step - 1)

  // 打亮框（padding 讓亮區比元素大一點）
  const pad = 8
  const hole = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  // tooltip 位置：有打亮框就放它下方（放不下就上方），否則置中
  const tipStyle: React.CSSProperties = hole
    ? hole.top + hole.height + 180 < window.innerHeight
      ? { top: hole.top + hole.height + 12, left: clampLeft(hole.left) }
      : { top: Math.max(12, hole.top - 172), left: clampLeft(hole.left) }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return createPortal(
    <div className="sr-tour" aria-live="polite">
      {/* 打亮框：box-shadow 撐出無限大的暗遮罩，中間留亮。pointer-events:none → 亮區照樣能操作 */}
      {hole && (
        <div
          className="sr-tour-hole"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        />
      )}
      {/* 沒有打亮框時，整頁鋪一層暗 */}
      {!hole && <div className="sr-tour-dim" />}

      <div className="sr-tour-tip" style={tipStyle} role="dialog" aria-label={current.title}>
        <div className="sr-tour-tip-head">
          <strong>{current.title}</strong>
          <span className="sr-muted">
            {step + 1} / {tour.steps.length}
          </span>
        </div>
        <p style={{ margin: 0 }}>{current.body}</p>
        <div className="sr-btn-row" style={{ marginTop: 'var(--sr-space-3)' }}>
          <button type="button" className="sr-button sr-button-secondary" onClick={close}>
            略過
          </button>
          <span style={{ flex: 1 }} />
          {step > 0 && (
            <button type="button" className="sr-button sr-button-secondary" onClick={prev}>
              上一步
            </button>
          )}
          <button type="button" className="sr-button" onClick={next}>
            {step + 1 < tour.steps.length ? '下一步' : '完成'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function clampLeft(left: number): number {
  const w = 340
  return Math.max(12, Math.min(left, window.innerWidth - w - 12))
}
