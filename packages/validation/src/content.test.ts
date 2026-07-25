import { describe, it, expect } from 'vitest'
import {
  passesContentFilter,
  passesContentFilterWith,
  compileFilterPatterns,
} from './content.js'

describe('passesContentFilter（底線）', () => {
  it('攔下情緒勒索與假稀缺', () => {
    expect(passesContentFilter('沒有你，我活不下去')).toBe(false)
    expect(passesContentFilter('只剩 3 小時就消失')).toBe(false)
    expect(passesContentFilter('連續 5 天沒來了')).toBe(false)
  })
  it('放行無辜用法', () => {
    expect(passesContentFilter('今天天氣很好')).toBe(true)
    expect(passesContentFilter('有沒有你沒看過的電影')).toBe(true)
  })
})

describe('compileFilterPatterns', () => {
  it('編譯有效正則', () => {
    const res = compileFilterPatterns(['abc', '\\d+天'])
    expect(res).toHaveLength(2)
    expect(res[0]!.test('xabcx')).toBe(true)
  })
  it('跳過無效正則、空字串、過長字串（不炸）', () => {
    const tooLong = 'a'.repeat(201)
    const res = compileFilterPatterns(['(', '', tooLong, 'ok'])
    expect(res.map((r) => r.source)).toEqual(['ok'])
  })
})

describe('passesContentFilterWith（附加層）', () => {
  it('extra 為空時等同底線', () => {
    expect(passesContentFilterWith('沒有你，我活不下去', [])).toBe(false)
    expect(passesContentFilterWith('今天天氣很好', [])).toBe(true)
  })
  it('extra 只會讓過濾更嚴，不會放寬底線', () => {
    // 底線攔的，即使 extra 為空也攔
    expect(passesContentFilterWith('只剩 3 小時就消失', [])).toBe(false)
    // 底線放行、但 extra 攔下
    const extra = compileFilterPatterns(['禁詞'])
    expect(passesContentFilterWith('這裡有禁詞', extra)).toBe(false)
    expect(passesContentFilterWith('這裡沒有那個字', extra)).toBe(true)
  })
})
