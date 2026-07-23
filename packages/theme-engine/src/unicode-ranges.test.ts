import { describe, it, expect } from 'vitest'
import {
  formatUnicodeRange,
  parseUnicodeRange,
  pairingFirstScreenBytes,
  zhHantSlices,
  slicesForScripts,
  budgetForScripts,
  CJK_CORE_CHARS,
  FIRST_SCREEN_BUDGET,
  LATIN_SLICES,
} from './unicode-ranges.js'

describe('formatUnicodeRange', () => {
  it('連續碼位合併成區間', () => {
    expect(formatUnicodeRange('abc')).toBe('U+0061-0063')
  })

  it('不連續的分開列出', () => {
    expect(formatUnicodeRange('ac')).toBe('U+0061,U+0063')
  })

  it('重複的字只出現一次', () => {
    expect(formatUnicodeRange('aaa')).toBe('U+0061')
  })

  it('順序不影響結果 —— 輸出一定是排序過的', () => {
    expect(formatUnicodeRange('cba')).toBe(formatUnicodeRange('abc'))
  })

  it('補到四位十六進位（低碼位不可輸出成 U+1）', () => {
    // 用跳脫寫法：控制字元直接寫在原始碼裡看不見，讀的人會以為是空字串
    expect(formatUnicodeRange('')).toBe('U+0001')
  })

  it('空字串回空字串，不是壞掉的 range', () => {
    expect(formatUnicodeRange('')).toBe('')
  })

  it('中文字正確轉成碼位', () => {
    expect(formatUnicodeRange('一')).toBe('U+4E00')
  })

  it('可以被 parseUnicodeRange 讀回來（round-trip）', () => {
    const chars = '的一是不了在人'
    const parsed = parseUnicodeRange(formatUnicodeRange(chars))
    expect(new Set(parsed)).toEqual(new Set([...chars].map((c) => c.codePointAt(0))))
  })
})

describe('parseUnicodeRange', () => {
  it('單一碼位', () => {
    expect(parseUnicodeRange('U+0041')).toEqual([0x41])
  })

  it('區間展開成每一個碼位', () => {
    expect(parseUnicodeRange('U+0041-0043')).toEqual([0x41, 0x42, 0x43])
  })

  it('逗號分隔的多段', () => {
    expect(parseUnicodeRange('U+0041,U+0043')).toEqual([0x41, 0x43])
  })

  it('容忍空白', () => {
    expect(parseUnicodeRange(' U+0041 , U+0043 ')).toEqual([0x41, 0x43])
  })

  it('起訖顛倒要拋錯，不能安靜地產生空片', () => {
    expect(() => parseUnicodeRange('U+0043-0041')).toThrow(/顛倒/)
  })

  it('不支援萬用字元，明確拋錯而不是猜', () => {
    expect(() => parseUnicodeRange('U+4??')).toThrow(/無法解析/)
  })

  it('空字串回空陣列', () => {
    expect(parseUnicodeRange('')).toEqual([])
  })
})

describe('繁中分片', () => {
  const slices = zhHantSlices()

  it('cjk-core 的 range 由常用字表算出，不是寫死的空字串', () => {
    const core = slices.find((s) => s.id === 'cjk-core')!
    expect(core.range).not.toBe('')
    expect(parseUnicodeRange(core.range).length).toBe(new Set([...CJK_CORE_CHARS]).size)
  })

  it('只有兩片是 critical —— 其餘靠 unicode-range 按需下載', () => {
    expect(slices.filter((s) => s.critical).map((s) => s.id)).toEqual([
      'cjk-punct-core',
      'cjk-core',
    ])
  })

  it('每一片的 range 都能被解析（寫錯了建置就會炸）', () => {
    for (const slice of slices) {
      expect(() => parseUnicodeRange(slice.range), slice.id).not.toThrow()
    }
  })

  it('id 不重複 —— 重複會讓後產生的檔案覆蓋前一個', () => {
    const ids = slices.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('常用字表沒有重複字（重複只是浪費，不會壞）', () => {
    expect(new Set([...CJK_CORE_CHARS]).size).toBe(CJK_CORE_CHARS.length)
  })

  it('常用字表全部落在 CJK 統一表意區', () => {
    for (const ch of CJK_CORE_CHARS) {
      const cp = ch.codePointAt(0)!
      expect(cp, ch).toBeGreaterThanOrEqual(0x4e00)
      expect(cp, ch).toBeLessThanOrEqual(0x9fff)
    }
  })
})

describe('拉丁分片', () => {
  it('latin-basic 是 critical，latin-ext 不是', () => {
    expect(LATIN_SLICES.find((s) => s.id === 'latin-basic')?.critical).toBe(true)
    expect(LATIN_SLICES.find((s) => s.id === 'latin-ext')?.critical).toBe(false)
  })

  it('兩片的碼位不重疊 —— 重疊會讓瀏覽器兩片都下載', () => {
    const basic = new Set(parseUnicodeRange(LATIN_SLICES[0]!.range))
    const ext = parseUnicodeRange(LATIN_SLICES[1]!.range)
    expect(ext.filter((cp) => basic.has(cp))).toEqual([])
  })
})

describe('slicesForScripts / budgetForScripts', () => {
  it('含 zh-Hant 用繁中分片', () => {
    expect(slicesForScripts(['zh-Hant', 'latin']).length).toBeGreaterThan(10)
  })

  it('純拉丁只有兩片', () => {
    expect(slicesForScripts(['latin'])).toHaveLength(2)
  })

  it('預算依 script 不同', () => {
    expect(budgetForScripts(['zh-Hant'])).toBe(FIRST_SCREEN_BUDGET.zhHant)
    expect(budgetForScripts(['latin'])).toBe(FIRST_SCREEN_BUDGET.latin)
  })
})

describe('pairingFirstScreenBytes', () => {
  const bytes = { a: 40_000, b: 30_000, c: 20_000 }

  it('同一套字體被指派到多個角色時只算一次', () => {
    expect(pairingFirstScreenBytes(['a', 'a', 'a', 'b'], bytes)).toBe(70_000)
  })

  it('不同字體累加', () => {
    expect(pairingFirstScreenBytes(['a', 'b', 'c'], bytes)).toBe(90_000)
  })

  it('未知的 slug 算 0 而不是 NaN', () => {
    expect(pairingFirstScreenBytes(['a', 'unknown'], bytes)).toBe(40_000)
  })

  it('空配對是 0', () => {
    expect(pairingFirstScreenBytes([], bytes)).toBe(0)
  })
})
