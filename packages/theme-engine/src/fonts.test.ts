import { describe, it, expect } from 'vitest'
import {
  buildFontFamily,
  compileFontVars,
  buildFontFaceCss,
  diffFontUsage,
  firstScreenBudget,
  type ResolvedFont,
} from './fonts.js'

const NOTO: ResolvedFont = {
  slug: 'noto-sans-tc',
  family: 'Noto Sans TC',
  fallbackStack: '"PingFang TC", sans-serif',
  weights: [400, 700],
}

const INTER: ResolvedFont = {
  slug: 'inter',
  family: 'Inter',
  fallbackStack: 'system-ui, sans-serif',
  weights: [400, 700],
}

const HUNINN: ResolvedFont = {
  slug: 'jf-open-huninn',
  family: 'jf open 粉圓',
  fallbackStack: '"PingFang TC", sans-serif',
  weights: [400],
}

describe('buildFontFamily', () => {
  it('拉丁字體排在中文字體之前', () => {
    const value = buildFontFamily(NOTO, INTER)
    expect(value.indexOf('Inter')).toBeLessThan(value.indexOf('Noto Sans TC'))
  })

  it('順序錯了英數字會被中文字體接走 —— 這條就是在守那個順序', () => {
    expect(buildFontFamily(NOTO, INTER)).toBe(
      '"Inter", "Noto Sans TC", "PingFang TC", sans-serif',
    )
  })

  it('含空白或非 ASCII 的名稱一定要有引號，否則整條宣告會被安靜忽略', () => {
    expect(buildFontFamily(HUNINN)).toContain('"jf open 粉圓"')
  })

  it('沒有拉丁字體時只有主字體與 fallback', () => {
    expect(buildFontFamily(NOTO)).toBe('"Noto Sans TC", "PingFang TC", sans-serif')
  })

  it('拉丁字體與主字體相同時不重複列出', () => {
    expect(buildFontFamily(INTER, INTER)).toBe('"Inter", system-ui, sans-serif')
  })

  it('fallback 一定在最後 —— 缺字時才有東西頂上', () => {
    expect(buildFontFamily(NOTO, INTER).endsWith('sans-serif')).toBe(true)
  })

  it('家族名內的引號會被移除，不會逃出字串產生新的宣告', () => {
    // fallbackStack 自己也有引號，所以只看家族名那一段
    const evil: ResolvedFont = {
      ...NOTO,
      family: 'Evil"; color: red; font-family: "x',
      fallbackStack: '',
    }
    const value = buildFontFamily(evil)
    expect(value.match(/"/g)?.length).toBe(2)
    expect(value).toBe('"Evil; color: red; font-family: x"')
  })

  it('fallbackStack 為空時不會留下多餘的逗號', () => {
    expect(buildFontFamily({ ...NOTO, fallbackStack: '' })).toBe('"Noto Sans TC"')
  })
})

describe('compileFontVars', () => {
  const base = { heading: NOTO, body: NOTO, ui: INTER }

  it('三個角色都有值', () => {
    const vars = compileFontVars(base)
    expect(Object.keys(vars).sort()).toEqual([
      '--sr-font-body',
      '--sr-font-heading',
      '--sr-font-ui',
    ])
  })

  it('沒有 mono 時不輸出 --sr-font-mono', () => {
    expect(compileFontVars(base)['--sr-font-mono']).toBeUndefined()
  })

  it('mono 不套拉丁字體 —— 混進另一套會破壞等寬對齊', () => {
    const mono: ResolvedFont = {
      slug: 'jetbrains-mono',
      family: 'JetBrains Mono',
      fallbackStack: 'monospace',
      weights: [400],
    }
    const vars = compileFontVars({ ...base, mono, latin: INTER })
    expect(vars['--sr-font-mono']).toBe('"JetBrains Mono", monospace')
    expect(vars['--sr-font-mono']).not.toContain('Inter')
  })

  it('latin 會套用到 heading / body / ui', () => {
    const vars = compileFontVars({ ...base, latin: INTER })
    expect(vars['--sr-font-heading']).toContain('Inter')
    expect(vars['--sr-font-body']).toContain('Inter')
  })
})

describe('buildFontFaceCss', () => {
  const spec = {
    family: 'Noto Sans TC',
    weight: 400,
    style: 'normal' as const,
    display: 'swap' as const,
    subsets: [
      { url: 'https://cdn/x/0.woff2', unicodeRange: 'U+4E00-4EFF' },
      { url: 'https://cdn/x/1.woff2', unicodeRange: 'U+5000-5FFF' },
    ],
  }

  it('每個分片產生一條 @font-face', () => {
    expect(buildFontFaceCss(spec).match(/@font-face/g)?.length).toBe(2)
  })

  it('每條都帶 unicode-range —— 少了它瀏覽器會下載全部分片', () => {
    const css = buildFontFaceCss(spec)
    expect(css).toContain('unicode-range: U+4E00-4EFF;')
    expect(css).toContain('unicode-range: U+5000-5FFF;')
  })

  it('中文字體用 font-display: swap，避免 FOIT 白畫面', () => {
    expect(buildFontFaceCss(spec)).toContain('font-display: swap;')
  })

  it('有 metric override 時才輸出', () => {
    expect(buildFontFaceCss(spec)).not.toContain('ascent-override')
    const withMetrics = buildFontFaceCss({ ...spec, ascentOverride: '90%' })
    expect(withMetrics).toContain('ascent-override: 90%;')
  })

  it('沒有分片時回傳空字串而不是壞掉的規則', () => {
    expect(buildFontFaceCss({ ...spec, subsets: [] })).toBe('')
  })
})

describe('diffFontUsage', () => {
  it('新增的要載入', () => {
    expect(diffFontUsage(['a'], ['a', 'b']).toLoad).toEqual(['b'])
  })

  it('不再使用的要卸載 —— 不卸載會累積成一堆沒用的 @font-face', () => {
    expect(diffFontUsage(['a', 'b'], ['a']).toUnload).toEqual(['b'])
  })

  it('完全換掉時兩邊都有內容', () => {
    const { toLoad, toUnload } = diffFontUsage(['a'], ['b'])
    expect(toLoad).toEqual(['b'])
    expect(toUnload).toEqual(['a'])
  })

  it('沒有變化時兩邊都空 —— 重複套用同一主題不該重載字體', () => {
    const { toLoad, toUnload } = diffFontUsage(['a', 'b'], ['b', 'a'])
    expect(toLoad).toEqual([])
    expect(toUnload).toEqual([])
  })

  it('第一次載入時 previous 為空', () => {
    expect(diffFontUsage([], ['a', 'b']).toLoad).toEqual(['a', 'b'])
  })
})

describe('firstScreenBudget', () => {
  it('只計算 critical 的分片', () => {
    const r = firstScreenBudget([
      { bytes: 50_000, critical: true },
      { bytes: 900_000, critical: false },
    ])
    expect(r.totalBytes).toBe(50_000)
    expect(r.withinBudget).toBe(true)
  })

  it('超過時說得出超了多少，而不只是「超了」', () => {
    const r = firstScreenBudget([{ bytes: 150 * 1024, critical: true }])
    expect(r.withinBudget).toBe(false)
    expect(r.overBy).toBe(50 * 1024)
  })

  it('剛好等於預算算通過', () => {
    expect(firstScreenBudget([{ bytes: 100 * 1024, critical: true }]).withinBudget).toBe(true)
  })

  it('沒有分片時為 0', () => {
    expect(firstScreenBudget([]).totalBytes).toBe(0)
  })
})
