import { describe, it, expect } from 'vitest'
import { hashToUnit } from '@snowrealm/validation'
import { solarTermFor, selectSeasonal, type SeasonalRow } from './seasonal.js'

// 固定 seed；真正的雜湊由 @snowrealm/validation 提供，測「選取邏輯」而非雜湊本身。
const SEED = 'space1:seasonal:2026-07-24'

function rows(...items: [string, string[]][]): SeasonalRow[] {
  return items.map(([text, tags]) => ({ text, tags }))
}

describe('selectSeasonal', () => {
  const summerTerm = solarTermFor(7, 24) // 大暑 / summer

  it('無天氣 tag → 維持純節氣行為（選節氣 slug 內容）', () => {
    const data = rows(
      ['大暑語', [summerTerm.slug]],
      ['夏語', [summerTerm.season]],
      ['雨天語', ['rainy']],
      ['通用語', []],
    )
    const picked = selectSeasonal(data, summerTerm, [], SEED, hashToUnit)
    // 沒有天氣 tag：byWeather 空 → 落回 bySlug（只有「大暑語」）
    expect(picked?.text).toBe('大暑語')
  })

  it('有天氣 tag 且有相交列 → 優先選天氣列（活化沉睡的天氣 seasonal 內容）', () => {
    const data = rows(
      ['大暑語', [summerTerm.slug]],
      ['雨天語A', ['rainy']],
      ['雨天語B', ['rainy']],
      ['通用語', []],
    )
    const picked = selectSeasonal(data, summerTerm, ['rainy'], SEED, hashToUnit)
    expect(['雨天語A', '雨天語B']).toContain(picked?.text)
  })

  it('冷 tag 也能命中（溫度 tag 一樣走天氣優先）', () => {
    const data = rows(
      ['大暑語', [summerTerm.slug]],
      ['寒冷語', ['cold']],
      ['通用語', []],
    )
    const picked = selectSeasonal(data, summerTerm, ['snowy', 'cold'], SEED, hashToUnit)
    expect(picked?.text).toBe('寒冷語')
  })

  it('有天氣 tag 但無相交列 → 退回節氣行為（不因空天氣池而壞掉）', () => {
    const data = rows(
      ['大暑語', [summerTerm.slug]],
      ['夏語', [summerTerm.season]],
      ['通用語', []],
    )
    // 天氣是 snowy，但池裡沒有 snowy 列 → byWeather 空 → 落回 bySlug
    const picked = selectSeasonal(data, summerTerm, ['snowy'], SEED, hashToUnit)
    expect(picked?.text).toBe('大暑語')
  })

  it('決定性：同輸入永遠選同一則', () => {
    const data = rows(['雨A', ['rainy']], ['雨B', ['rainy']], ['雨C', ['rainy']])
    const a = selectSeasonal(data, summerTerm, ['rainy'], SEED, hashToUnit)
    const b = selectSeasonal(data, summerTerm, ['rainy'], SEED, hashToUnit)
    expect(a?.text).toBe(b?.text)
  })

  it('空池 → null', () => {
    expect(selectSeasonal([], summerTerm, ['rainy'], SEED, hashToUnit)).toBeNull()
  })

  it('無相交也無節氣 slug/season → 用整池（總比沒有好）', () => {
    const data = rows(['通用1', []], ['通用2', []])
    const picked = selectSeasonal(data, summerTerm, ['typhoon'], SEED, hashToUnit)
    expect(['通用1', '通用2']).toContain(picked?.text)
  })
})
