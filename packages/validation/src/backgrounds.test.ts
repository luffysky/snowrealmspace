import { describe, it, expect } from 'vitest'
import {
  backgroundCreateSchema,
  backgroundPatchSchema,
  gradientSpecSchema,
  playlistCreateSchema,
  scheduleSchema,
  reorderSchema,
  ALPHA_TRANSITIONS,
} from './backgrounds.js'

const assetId = '11111111-1111-4111-8111-111111111111'

describe('backgroundCreateSchema', () => {
  it('圖片背景需要 assetId', () => {
    expect(backgroundCreateSchema.safeParse({ type: 'image' }).success).toBe(false)
    expect(backgroundCreateSchema.safeParse({ type: 'image', assetId }).success).toBe(true)
  })

  it('影片背景需要 assetId', () => {
    expect(backgroundCreateSchema.safeParse({ type: 'video' }).success).toBe(false)
    expect(backgroundCreateSchema.safeParse({ type: 'video', assetId }).success).toBe(true)
  })

  it('漸層背景需要 gradientSpec', () => {
    expect(backgroundCreateSchema.safeParse({ type: 'gradient' }).success).toBe(false)
    expect(
      backgroundCreateSchema.safeParse({
        type: 'gradient',
        gradientSpec: {
          kind: 'linear',
          angle: 90,
          stops: [
            { color: '#ffffff', position: 0 },
            { color: '#000000', position: 100 },
          ],
        },
      }).success,
    ).toBe(true)
  })

  it('程式動畫背景需要 proceduralId', () => {
    expect(backgroundCreateSchema.safeParse({ type: 'procedural' }).success).toBe(false)
    expect(
      backgroundCreateSchema.safeParse({ type: 'procedural', proceduralId: 'aurora' }).success,
    ).toBe(true)
  })

  it('套用合理的預設值', () => {
    const parsed = backgroundCreateSchema.parse({ type: 'image', assetId })
    expect(parsed.fit).toBe('cover')
    expect(parsed.zoom).toBe(1)
    expect(parsed.blur).toBe(0)
    expect(parsed.overlayOpacity).toBe(0)
  })

  it.each([
    ['zoom 過大', { zoom: 99 }],
    ['zoom 過小', { zoom: 0.1 }],
    ['blur 過大', { blur: 999 }],
    ['brightness 為 0', { brightness: 0 }],
    ['position 超出範圍', { positionX: 150 }],
    ['overlayOpacity 超出範圍', { overlayOpacity: 2 }],
  ])('拒絕 %s', (_label, patch) => {
    expect(backgroundCreateSchema.safeParse({ type: 'image', assetId, ...patch }).success).toBe(
      false,
    )
  })

  it('拒絕非 hex 的疊色', () => {
    expect(
      backgroundCreateSchema.safeParse({ type: 'image', assetId, overlayColor: 'black' }).success,
    ).toBe(false)
  })

  it('拒絕多餘欄位（strict）', () => {
    expect(
      backgroundCreateSchema.safeParse({ type: 'image', assetId, bogusField: 1 }).success,
    ).toBe(false)
  })

  it('muted 可由客戶端指定（ADR-019 偏離：影片可選聲音）', () => {
    const r = backgroundCreateSchema.parse({ type: 'video', assetId, muted: false })
    expect(r.muted).toBe(false)
    // 預設仍靜音（autoplay 政策）
    expect(backgroundCreateSchema.parse({ type: 'video', assetId }).muted).toBe(true)
  })
})

describe('gradientSpecSchema', () => {
  it('至少要兩個色停', () => {
    expect(
      gradientSpecSchema.safeParse({
        kind: 'linear',
        angle: 0,
        stops: [{ color: '#ffffff', position: 0 }],
      }).success,
    ).toBe(false)
  })

  /** 只接受結構化資料 —— 接受 CSS 字串就是開一個注入管道。 */
  it('色停只接受 hex，不接受任意 CSS', () => {
    for (const evil of ['url(x)', 'var(--x)', 'red', 'rgb(0,0,0)']) {
      expect(
        gradientSpecSchema.safeParse({
          kind: 'linear',
          angle: 0,
          stops: [
            { color: evil, position: 0 },
            { color: '#000000', position: 100 },
          ],
        }).success,
        evil,
      ).toBe(false)
    }
  })

  it('角度限制在 0–360', () => {
    const stops = [
      { color: '#ffffff', position: 0 },
      { color: '#000000', position: 100 },
    ]
    expect(gradientSpecSchema.safeParse({ kind: 'linear', angle: 400, stops }).success).toBe(false)
  })
})

describe('playlistCreateSchema', () => {
  it('名稱必填', () => {
    expect(playlistCreateSchema.safeParse({}).success).toBe(false)
    expect(playlistCreateSchema.safeParse({ name: '  ' }).success).toBe(false)
  })

  it('預設為依序播放、淡入淡出', () => {
    const parsed = playlistCreateSchema.parse({ name: '我的清單' })
    expect(parsed.playMode).toBe('sequential')
    expect(parsed.transition).toBe('fade')
    expect(parsed.intervalSeconds).toBe(900)
  })

  it('間隔至少 5 秒', () => {
    expect(playlistCreateSchema.safeParse({ name: 'x', intervalSeconds: 1 }).success).toBe(false)
  })

  it('Alpha 的三種轉場都在 schema 中（v1.0 §12.4）', () => {
    for (const t of ALPHA_TRANSITIONS) {
      expect(playlistCreateSchema.safeParse({ name: 'x', transition: t }).success, t).toBe(true)
    }
  })
})

describe('scheduleSchema', () => {
  it('接受跨午夜的時段', () => {
    const parsed = scheduleSchema.safeParse({
      slots: [{ startHour: 21, endHour: 6, backgroundItemId: assetId }],
    })
    expect(parsed.success).toBe(true)
  })

  it('endHour 可以是 24（代表午夜）', () => {
    expect(
      scheduleSchema.safeParse({
        slots: [{ startHour: 18, endHour: 24, backgroundItemId: assetId }],
      }).success,
    ).toBe(true)
  })

  it('拒絕超出範圍的小時', () => {
    expect(
      scheduleSchema.safeParse({
        slots: [{ startHour: 25, endHour: 6, backgroundItemId: assetId }],
      }).success,
    ).toBe(false)
  })
})

describe('reorderSchema', () => {
  it('至少一個 id', () => {
    expect(reorderSchema.safeParse({ orderedItemIds: [] }).success).toBe(false)
  })

  it('拒絕非 uuid', () => {
    expect(reorderSchema.safeParse({ orderedItemIds: ['abc'] }).success).toBe(false)
  })
})

describe('霧面玻璃欄位', () => {
  it('預設關閉、有合理預設值', () => {
    const parsed = backgroundCreateSchema.parse({ type: 'image', assetId })
    expect(parsed.glassEnabled).toBe(false)
    expect(parsed.glassBlur).toBe(12)
    expect(parsed.glassOpacity).toBe(0.3)
    expect(parsed.glassRadius).toBe(16)
  })

  it('霧度上限 60', () => {
    expect(
      backgroundPatchSchema.safeParse({ glassBlur: 61 }).success,
    ).toBe(false)
    expect(backgroundPatchSchema.safeParse({ glassBlur: 60 }).success).toBe(true)
  })

  it('玻璃顏色必須是 #RRGGBB', () => {
    expect(backgroundPatchSchema.safeParse({ glassColor: 'white' }).success).toBe(false)
    expect(backgroundPatchSchema.safeParse({ glassColor: '#aabbcc' }).success).toBe(true)
  })
})

describe('裁切欄位', () => {
  it('預設整張 0,0,100,100', () => {
    const parsed = backgroundCreateSchema.parse({ type: 'image', assetId })
    expect([parsed.cropX, parsed.cropY, parsed.cropW, parsed.cropH]).toEqual([0, 0, 100, 100])
  })

  it('合法的部分裁切', () => {
    expect(
      backgroundCreateSchema.safeParse({
        type: 'image',
        assetId,
        cropX: 10,
        cropY: 10,
        cropW: 50,
        cropH: 50,
      }).success,
    ).toBe(true)
  })

  it('裁切超出右邊界被擋（x + w > 100）', () => {
    const r = backgroundCreateSchema.safeParse({
      type: 'image',
      assetId,
      cropX: 60,
      cropY: 0,
      cropW: 50,
      cropH: 100,
    })
    expect(r.success).toBe(false)
  })

  it('patch 四個裁切值齊全時驗邊界', () => {
    expect(
      backgroundPatchSchema.safeParse({ cropX: 0, cropY: 70, cropW: 100, cropH: 50 }).success,
    ).toBe(false)
    expect(
      backgroundPatchSchema.safeParse({ cropX: 0, cropY: 0, cropW: 100, cropH: 100 }).success,
    ).toBe(true)
  })
})
