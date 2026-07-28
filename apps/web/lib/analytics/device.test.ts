import { describe, it, expect } from 'vitest'
import { parseDevice } from './device.js'

describe('parseDevice', () => {
  it('空值 / null / undefined → 保守預設 desktop/Other/Other，不拋錯', () => {
    expect(parseDevice(null)).toEqual({ deviceType: 'desktop', browser: 'Other', os: 'Other' })
    expect(parseDevice(undefined)).toEqual({ deviceType: 'desktop', browser: 'Other', os: 'Other' })
    expect(parseDevice('')).toEqual({ deviceType: 'desktop', browser: 'Other', os: 'Other' })
  })

  it('iPhone Safari → mobile / Safari / iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(parseDevice(ua)).toEqual({ deviceType: 'mobile', browser: 'Safari', os: 'iOS' })
  })

  it('iPad → tablet / Safari / iOS（即使 UA 含 mobile）', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    const r = parseDevice(ua)
    expect(r.deviceType).toBe('tablet')
    expect(r.os).toBe('iOS')
  })

  it('Android Chrome 手機 → mobile / Chrome / Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(parseDevice(ua)).toEqual({ deviceType: 'mobile', browser: 'Chrome', os: 'Android' })
  })

  it('Android 平板 → tablet / Chrome / Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 12; SM-X200 Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
    const r = parseDevice(ua)
    expect(r.deviceType).toBe('tablet')
    expect(r.browser).toBe('Chrome')
    expect(r.os).toBe('Android')
  })

  it('Windows Chrome 桌機 → desktop / Chrome / Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseDevice(ua)).toEqual({ deviceType: 'desktop', browser: 'Chrome', os: 'Windows' })
  })

  it('Edge → Edge（不能誤判成 Chrome，雖然 UA 含 chrome）', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(parseDevice(ua).browser).toBe('Edge')
  })

  it('Opera → Opera（不能誤判成 Chrome）', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0'
    expect(parseDevice(ua).browser).toBe('Opera')
  })

  it('macOS Safari → desktop / Safari / macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    expect(parseDevice(ua)).toEqual({ deviceType: 'desktop', browser: 'Safari', os: 'macOS' })
  })

  it('Firefox on Linux → desktop / Firefox / Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
    expect(parseDevice(ua)).toEqual({ deviceType: 'desktop', browser: 'Firefox', os: 'Linux' })
  })

  it('Chrome on iOS（crios）→ mobile / Chrome / iOS，不誤判成 Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.0.0 Mobile/15E148 Safari/604.1'
    const r = parseDevice(ua)
    expect(r.deviceType).toBe('mobile')
    expect(r.browser).toBe('Chrome')
    expect(r.os).toBe('iOS')
  })
})
