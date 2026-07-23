import { describe, it, expect } from 'vitest'
import {
  WIDGET_REGISTRY,
  WIDGET_IDS,
  getWidgetDefinition,
  defaultLayoutItems,
  type WidgetDefinition,
} from './registry.js'
import { validateItem, validateLayout, GRID } from './grid.js'

const entries = Object.entries(WIDGET_REGISTRY) as [string, WidgetDefinition<unknown>][]

describe('WIDGET_REGISTRY', () => {
  it('每個註冊的 id 都在 WIDGET_IDS 中', () => {
    for (const [key] of entries) {
      expect(WIDGET_IDS).toContain(key)
    }
  })

  it('definition.id 與 key 一致', () => {
    for (const [key, def] of entries) {
      expect(def.id).toBe(key)
    }
  })

  it('涵蓋 v1.0 §14.2 列出的九個 Birthday Alpha widget', () => {
    for (const id of [
      'daily_card',
      'surprise_box',
      'agent_message',
      'current_project',
      'recent_designs',
      'quick_note',
      'theme_switcher',
      'background_control',
      'timeline_preview',
    ]) {
      expect(getWidgetDefinition(id), `缺少 ${id}`).not.toBeNull()
    }
  })

  it('defaultSize 落在 min/max 之間', () => {
    for (const [key, def] of entries) {
      expect(def.defaultSize.w, `${key} 寬度`).toBeGreaterThanOrEqual(def.minSize.w)
      expect(def.defaultSize.w, `${key} 寬度`).toBeLessThanOrEqual(def.maxSize.w)
      expect(def.defaultSize.h, `${key} 高度`).toBeGreaterThanOrEqual(def.minSize.h)
      expect(def.defaultSize.h, `${key} 高度`).toBeLessThanOrEqual(def.maxSize.h)
    }
  })

  it('maxSize 不超過 desktop 欄數', () => {
    for (const [key, def] of entries) {
      expect(def.maxSize.w, `${key}`).toBeLessThanOrEqual(GRID.desktop.columns)
    }
  })

  it('defaultConfig 通過自己的 schema', () => {
    for (const [key, def] of entries) {
      const result = def.configSchema.safeParse(def.defaultConfig)
      expect(result.success, `${key}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('schema 拒絕不合法的 config', () => {
    const recentDesigns = getWidgetDefinition('recent_designs')!
    expect(recentDesigns.configSchema.safeParse({ limit: 999 }).success).toBe(false)
    expect(recentDesigns.configSchema.safeParse({ layout: 'spiral' }).success).toBe(false)
  })

  it('每個 widget 都宣告了權限或明確為空', () => {
    for (const [key, def] of entries) {
      expect(Array.isArray(def.permissions), `${key}`).toBe(true)
    }
  })

  it('版本號格式一致', () => {
    for (const [key, def] of entries) {
      expect(def.version, `${key}`).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('名稱與描述非空（UI 會直接顯示）', () => {
    for (const [key, def] of entries) {
      expect(def.name.length, `${key} 名稱`).toBeGreaterThan(0)
      expect(def.description.length, `${key} 描述`).toBeGreaterThan(0)
    }
  })

  /** ADR-019：影片背景必須可暫停（WCAG Pause, Stop, Hide）。 */
  it('背景控制的暫停功能預設開啟', () => {
    const def = getWidgetDefinition('background_control')!
    const config = def.configSchema.parse({}) as { allowPause: boolean }
    expect(config.allowPause).toBe(true)
  })
})

describe('getWidgetDefinition', () => {
  it('未知 id 回 null 而非拋錯', () => {
    expect(getWidgetDefinition('nonexistent')).toBeNull()
  })

  it('尚未實作的 future widget 也回 null', () => {
    expect(getWidgetDefinition('weather')).toBeNull()
  })
})

describe('defaultLayoutItems', () => {
  it('預設版面無重疊且在格線內', () => {
    const items = defaultLayoutItems()
    expect(validateLayout(items, GRID.desktop.columns).ok).toBe(true)
  })

  it('每個項目都符合其 widget 的尺寸限制', () => {
    for (const item of defaultLayoutItems()) {
      const def = getWidgetDefinition(item.id)
      expect(def, `${item.id} 未註冊`).not.toBeNull()
      const result = validateItem(
        item,
        {
          minW: def!.minSize.w,
          minH: def!.minSize.h,
          maxW: def!.maxSize.w,
          maxH: def!.maxSize.h,
        },
        GRID.desktop.columns,
      )
      expect(result.ok, `${item.id}: ${result.ok ? '' : result.reason}`).toBe(true)
    }
  })

  /**
   * Q6：無假按鈕。
   * 預設版面只能放「現在真的有內容」的 widget ——
   * daily_card 要等 Milestone E 才有東西可顯示。
   */
  it('只包含已實作、有內容的 widget', () => {
    // daily_card 在 Milestone E 有了內容（content_items 池），故加入預設版面。
    // 其餘尚無內容的不該進預設（Q6：無假東西）。
    const notYetImplemented = ['surprise_box', 'agent_message', 'timeline_preview']
    for (const item of defaultLayoutItems()) {
      expect(notYetImplemented, `${item.id} 尚未有內容，不該進預設版面`).not.toContain(item.id)
    }
  })

  it('每次呼叫回傳可安全修改的新陣列', () => {
    const a = defaultLayoutItems()
    a[0]!.x = 99
    expect(defaultLayoutItems()[0]!.x).not.toBe(99)
  })
})
