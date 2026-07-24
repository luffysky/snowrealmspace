'use client'

import { useEffect, useRef } from 'react'
import { getScene, type SceneDef, type SceneShape } from '@/lib/scenes'

/**
 * 內建動態場景（雪/雨/櫻花…）。canvas 粒子系統，資料驅動（見 lib/scenes）。
 *
 * 兩種用法：overlay=true → 透明底、只畫粒子，疊在別的背景上；否則 base 當底色（獨立動態背景）。
 * density 為 background_item 存的密度倍率。
 *
 * 無障礙/效能：reduced-motion 或省流量 → 只顯示靜態底、不跑動畫；分頁不可見或 paused → 暫停。
 */
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
  phase: number
  vphase: number
  rot: number
  vr: number
  color: string
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function drawShape(c: CanvasRenderingContext2D, shape: SceneShape, p: Particle) {
  const col = `rgba(${p.color},${p.a})`
  if (shape === 'streak') {
    c.strokeStyle = col
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(p.x, p.y)
    c.lineTo(p.x - 1.5, p.y + p.r)
    c.stroke()
    return
  }
  if (shape === 'ring') {
    c.strokeStyle = col
    c.lineWidth = 1
    c.beginPath()
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    c.stroke()
    return
  }
  if (shape === 'petal') {
    c.save()
    c.translate(p.x, p.y)
    c.rotate(p.rot)
    c.fillStyle = col
    c.beginPath()
    c.ellipse(0, 0, p.r, p.r * 0.52, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
    return
  }
  if (shape === 'square') {
    c.save()
    c.translate(p.x, p.y)
    c.rotate(p.rot)
    c.fillStyle = col
    c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.4)
    c.restore()
    return
  }
  if (shape === 'heart') {
    c.save()
    c.translate(p.x, p.y)
    c.rotate(p.rot * 0.3)
    c.scale(p.r / 10, p.r / 10)
    c.fillStyle = col
    c.beginPath()
    c.moveTo(0, 3)
    c.bezierCurveTo(0, 0, -5, -2, -5, 2)
    c.bezierCurveTo(-5, 6, 0, 8, 0, 11)
    c.bezierCurveTo(0, 8, 5, 6, 5, 2)
    c.bezierCurveTo(5, -2, 0, 0, 0, 3)
    c.fill()
    c.restore()
    return
  }
  if (shape === 'star') {
    c.save()
    c.translate(p.x, p.y)
    c.fillStyle = col
    c.beginPath()
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5
      const ox = Math.cos(ang) * p.r
      const oy = Math.sin(ang) * p.r
      i === 0 ? c.moveTo(ox, oy) : c.lineTo(ox, oy)
      const ia = ang + Math.PI / 5
      c.lineTo(Math.cos(ia) * p.r * 0.45, Math.sin(ia) * p.r * 0.45)
    }
    c.closePath()
    c.fill()
    c.restore()
    return
  }
  // circle
  c.fillStyle = col
  c.beginPath()
  c.arc(p.x, p.y, p.r, 0, Math.PI * 2)
  c.fill()
}

export function ProceduralScene({
  sceneId,
  density = 1,
  overlay = false,
  paused = false,
}: {
  sceneId: string | null
  density?: number
  overlay?: boolean
  paused?: boolean
}) {
  const scene = getScene(sceneId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const densityRef = useRef(density)
  densityRef.current = density

  useEffect(() => {
    if (!scene || scene.kind !== 'dynamic') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const saveData =
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
    if (reduce || saveData) return

    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !parent || !ctx) return

    const def: SceneDef = scene
    const behavior = def.behavior ?? 'fall'
    const shape: SceneShape = def.shape ?? 'circle'
    const colors = def.colors ?? ['255,255,255']
    const speed = def.speed ?? 1
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let particles: Particle[] = []

    function make(initial: boolean): Particle {
      const r = rand(def.sizeMin ?? 1, def.sizeMax ?? 3)
      const color = colors[Math.floor(Math.random() * colors.length)]!
      const base: Particle = { x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, r, a: rand(0.5, 0.95), phase: rand(0, Math.PI * 2), vphase: rand(0.01, 0.05), rot: rand(0, Math.PI * 2), vr: rand(-0.04, 0.04), color }
      if (behavior === 'rain') {
        base.vy = rand(9, 16) * speed
        base.a = rand(0.15, 0.4)
        base.y = initial ? rand(-h, h) : rand(-h, -10)
      } else if (behavior === 'twinkle') {
        base.vphase = rand(0.02, 0.06)
      } else if (behavior === 'wander') {
        base.vx = rand(-0.4, 0.4) * speed
        base.vy = rand(-0.4, 0.4) * speed
        base.a = rand(0.3, 1)
      } else if (behavior === 'rise') {
        base.vy = -rand(0.4, 1.2) * speed
        base.a = rand(0.2, 0.6)
        base.y = initial ? rand(0, h) : h + rand(6, 40)
      } else {
        // fall / petal
        base.vx = rand(-0.4, 0.6) * speed
        base.vy = rand(0.4, 1.4) * speed
        base.y = initial ? rand(0, h) : rand(-40, -6)
      }
      return base
    }

    function init() {
      const area = w * h
      const divisor = 8000 / Math.max(0.15, Math.min(3, (def.density ?? 1) * densityRef.current))
      const count = Math.min(600, Math.max(10, Math.round(area / divisor)))
      particles = Array.from({ length: count }, () => make(true))
    }

    function resize() {
      const rect = parent!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      init()
    }

    function step(p: Particle, k: number) {
      p.phase += p.vphase * k
      if (behavior === 'twinkle') {
        p.a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(p.phase))
        return
      }
      if (behavior === 'wander') {
        p.vx = Math.max(-0.7, Math.min(0.7, p.vx + rand(-0.03, 0.03) * k))
        p.vy = Math.max(-0.7, Math.min(0.7, p.vy + rand(-0.03, 0.03) * k))
        p.x += p.vx * k
        p.y += p.vy * k
        p.a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(p.phase))
        if (p.x < -12) p.x = w + 10
        if (p.x > w + 12) p.x = -10
        if (p.y < -12) p.y = h + 10
        if (p.y > h + 12) p.y = -10
        return
      }
      if (behavior === 'rise') {
        p.x += Math.sin(p.phase) * 0.4 * k
        p.y += p.vy * k
        if (p.y < -p.r - 6) Object.assign(p, make(false))
        return
      }
      // fall / petal / rain
      const sway = behavior === 'petal' ? Math.sin(p.phase) * 0.7 : behavior === 'fall' ? Math.sin(p.phase) * 0.3 : 0
      p.x += (p.vx + sway) * k
      p.y += p.vy * k
      p.rot += p.vr * k
      if (p.y > h + 16) Object.assign(p, make(false))
      if (p.x < -14) p.x = w + 10
      if (p.x > w + 14) p.x = -10
    }

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const k = Math.min(3, (now - last) / 16)
      last = now
      if (document.visibilityState === 'visible' && !pausedRef.current) {
        ctx!.clearRect(0, 0, w, h)
        for (const p of particles) {
          step(p, k)
          drawShape(ctx!, shape, p)
        }
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [scene])

  if (!scene) return null
  return (
    <div
      className="sr-bg-media"
      style={{ background: overlay ? 'transparent' : scene.base }}
      aria-hidden="true"
    >
      {scene.kind === 'dynamic' && (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}
    </div>
  )
}
