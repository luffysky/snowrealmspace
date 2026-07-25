import { describe, it, expect } from 'vitest'
import { describeConfig, editableConfigFields, parseConfig } from './config-fields.js'

describe('describeConfig', () => {
  it('boolean 欄位帶正確的預設值', () => {
    const fields = describeConfig('daily_card')
    const archive = fields.find((f) => f.key === 'showArchiveLink')
    expect(archive).toMatchObject({ kind: 'boolean', default: true })
    const compact = fields.find((f) => f.key === 'compact')
    expect(compact).toMatchObject({ kind: 'boolean', default: false })
  })

  it('number 欄位帶 min / max / 預設', () => {
    const field = describeConfig('agent_message').find((f) => f.key === 'maxMessages')
    expect(field).toMatchObject({ kind: 'number', min: 1, max: 5, default: 1, step: 1 })
  })

  it('enum 欄位帶選項', () => {
    const field = describeConfig('recent_designs').find((f) => f.key === 'layout')
    expect(field).toMatchObject({ kind: 'enum', options: ['grid', 'carousel'], default: 'grid' })
  })

  it('string 欄位帶 maxLength 與預設', () => {
    const field = describeConfig('quick_note').find((f) => f.key === 'placeholder')
    expect(field).toMatchObject({ kind: 'string', maxLength: 80 })
    expect((field as { default: string }).default).toBe('隨手記下…')
  })

  it('專案參照 uuid 欄位標為 project —— 給專用選擇器，不給文字框', () => {
    const field = describeConfig('current_project').find((f) => f.key === 'projectId')
    expect(field?.kind).toBe('project')
  })

  it('有中文標籤，沒對照時退回欄位名而不是空白', () => {
    for (const field of describeConfig('daily_card')) {
      expect(field.label.length).toBeGreaterThan(0)
    }
  })

  it('未知 widget 回空陣列而不是拋錯', () => {
    // @ts-expect-error 故意傳不存在的 id
    expect(describeConfig('does_not_exist')).toEqual([])
  })
})

describe('editableConfigFields', () => {
  it('保留專案參照欄位（project 型別，不再被當 unsupported 濾掉）', () => {
    const editable = editableConfigFields('current_project')
    expect(editable.some((f) => f.key === 'projectId' && f.kind === 'project')).toBe(true)
  })

  it('每個 Alpha widget 至少有一個可編輯欄位', () => {
    for (const id of [
      'daily_card',
      'surprise_box',
      'agent_message',
      'recent_designs',
      'quick_note',
      'theme_switcher',
      'background_control',
      'timeline_preview',
    ] as const) {
      expect(editableConfigFields(id).length, id).toBeGreaterThan(0)
    }
  })
})

describe('parseConfig', () => {
  it('合法值原樣通過並補上預設', () => {
    const result = parseConfig('daily_card', { compact: true }) as { showArchiveLink: boolean }
    expect(result.showArchiveLink).toBe(true) // 補上的預設
  })

  it('非法值退回預設而不是拋錯 —— 手改的請求不可讓頁面崩潰', () => {
    const result = parseConfig('agent_message', { maxMessages: 999 }) as { maxMessages: number }
    // 999 超過 max 5，safeParse 失敗 → 整包退回 defaultConfig
    expect(result.maxMessages).toBe(1)
  })

  it('完全不是物件也不崩', () => {
    expect(() => parseConfig('daily_card', 'garbage')).not.toThrow()
  })
})
