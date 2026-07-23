import { describe, it, expect } from 'vitest'
import { isAnalyticsOnly, ANALYTICS_ONLY_EVENTS, type DomainEventType } from './events.js'

describe('isAnalyticsOnly', () => {
  it('space.opened 是純分析事件 —— 關閉追蹤時不寫入', () => {
    expect(isAnalyticsOnly('space.opened')).toBe(true)
  })

  it('widget.error 是純分析事件', () => {
    expect(isAnalyticsOnly('widget.error')).toBe(true)
  })

  /**
   * 這組是重點：即使使用者關閉活動追蹤，這些事件仍必須寫入，
   * 因為它們會影響產品行為（Timeline、記憶、專案狀態），
   * 不寫入會讓功能出現無法解釋的空洞。
   */
  it.each([
    'theme.applied',
    'memory.approved',
    'project.created',
    'asset.uploaded',
    'settings.changed',
    'surprise.unlocked',
  ] as DomainEventType[])('%s 即使關閉追蹤也必須寫入', (type) => {
    expect(isAnalyticsOnly(type)).toBe(false)
  })

  it('純分析事件清單不含任何會影響產品行為的事件', () => {
    const behavioural = ['theme.applied', 'memory.approved', 'asset.uploaded', 'project.created']
    for (const type of behavioural) {
      expect(ANALYTICS_ONLY_EVENTS.has(type as DomainEventType)).toBe(false)
    }
  })
})
