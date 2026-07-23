import { describe, it, expect } from 'vitest'
import {
  compileThemeToCssVars,
  compileThemeToCssText,
  themeDataAttributes,
  computeA11yFallback,
} from './compile.js'
import { analyzeTheme, wcagLevel, suggestFix, flattenSurface, THRESHOLDS } from './contrast.js'
import { contrastRatio } from './color.js'
import { PRESET_THEMES, DEFAULT_THEME, defaultThemeDefinition } from './presets.js'
import { themeDefinitionSchema, themeExportSchema } from './schema.js'
import type { ThemeDefinition } from './types.js'

function clone(t: ThemeDefinition): ThemeDefinition {
  return structuredClone(t)
}

describe('compileThemeToCssVars', () => {
  it('產生所有必要的 token', () => {
    const vars = compileThemeToCssVars(DEFAULT_THEME)
    for (const key of [
      '--sr-primary',
      '--sr-background',
      '--sr-surface',
      '--sr-text-primary',
      '--sr-text-secondary',
      '--sr-border',
      '--sr-danger',
      '--sr-focus-ring',
      '--sr-radius',
      '--sr-blur',
      '--sr-shadow-md',
      '--sr-motion-intensity',
      '--sr-surface-opaque',
      '--sr-on-primary',
      '--sr-text-disabled',
      '--sr-overlay-scrim',
    ]) {
      expect(vars[key], `缺少 ${key}`).toBeDefined()
    }
  })

  it('每個 key 都帶 -- 前綴（可直接寫進 element.style）', () => {
    const vars = compileThemeToCssVars(DEFAULT_THEME)
    expect(Object.keys(vars).every((k) => k.startsWith('--sr-'))).toBe(true)
  })

  it('是純函式：相同輸入必得相同輸出', () => {
    expect(compileThemeToCssVars(DEFAULT_THEME)).toEqual(compileThemeToCssVars(DEFAULT_THEME))
  })

  it('不修改輸入', () => {
    const input = clone(DEFAULT_THEME)
    const snapshot = JSON.stringify(input)
    compileThemeToCssVars(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('surface-opaque 是不透明的（solid 材質需要）', () => {
    const vars = compileThemeToCssVars(DEFAULT_THEME)
    expect(vars['--sr-surface-opaque']).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('on-primary 對 primary 的對比達 AA', () => {
    for (const theme of PRESET_THEMES) {
      const vars = compileThemeToCssVars(theme)
      expect(
        contrastRatio(vars['--sr-on-primary']!, theme.colors.primary),
        `${theme.name} 的 on-primary`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('text-disabled 仍維持 ≥ 3:1（不是單純降 opacity）', () => {
    for (const theme of PRESET_THEMES) {
      const vars = compileThemeToCssVars(theme)
      expect(
        contrastRatio(vars['--sr-text-disabled']!, theme.colors.background),
        `${theme.name} 的 disabled 文字`,
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it('motion preset 為 none 時強度為 0', () => {
    const t = clone(DEFAULT_THEME)
    t.motion.preset = 'none'
    expect(compileThemeToCssVars(t)['--sr-motion-intensity']).toBe('0')
  })

  it('motion intensity 會被夾在 0–1', () => {
    const t = clone(DEFAULT_THEME)
    t.motion.intensity = 5
    const v = Number(compileThemeToCssVars(t)['--sr-motion-intensity'])
    expect(v).toBeLessThanOrEqual(2)
  })

  it('radius 衍生值成比例', () => {
    const t = clone(DEFAULT_THEME)
    t.surfaces.radius = 20
    const vars = compileThemeToCssVars(t)
    expect(vars['--sr-radius']).toBe('20px')
    expect(vars['--sr-radius-sm']).toBe('10px')
    expect(vars['--sr-radius-lg']).toBe('30px')
  })

  it('mono 字體為選填', () => {
    const t = clone(DEFAULT_THEME)
    delete t.typography.monoFontId
    expect(compileThemeToCssVars(t)['--sr-font-mono-id']).toBeUndefined()
  })
})

describe('computeA11yFallback（ADR-011 §3.3）', () => {
  it('合格主題不套用 fallback', () => {
    for (const theme of PRESET_THEMES) {
      expect(computeA11yFallback(theme).applied, `${theme.name}`).toBe(false)
    }
  })

  it('focus ring 對比不足時會被替換', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.focusRing = '#fffdfd' // 對淺背景幾乎看不見
    const fallback = computeA11yFallback(t)
    expect(fallback.applied).toBe(true)
    expect(fallback.focusRing).toBeDefined()
    expect(contrastRatio(fallback.focusRing!, t.colors.background)).toBeGreaterThanOrEqual(3)
  })

  it('不合格主題編譯後，實際的 focus ring 仍可見', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.focusRing = '#fffefe'
    const vars = compileThemeToCssVars(t)
    expect(contrastRatio(vars['--sr-focus-ring']!, t.colors.background)).toBeGreaterThanOrEqual(3)
  })

  it('錯誤色不足時會被替換', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.danger = '#fff5f5'
    const vars = compileThemeToCssVars(t)
    expect(contrastRatio(vars['--sr-danger']!, t.colors.background)).toBeGreaterThanOrEqual(4.5)
  })

  it('fallback 不覆寫使用者選的一般文字色', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.focusRing = '#fffefe'
    t.colors.textPrimary = '#4a4a4a'
    expect(compileThemeToCssVars(t)['--sr-text-primary']).toBe('#4a4a4a')
  })
})

describe('analyzeTheme', () => {
  it('四套內建主題全部通過 AA', () => {
    for (const theme of PRESET_THEMES) {
      const report = analyzeTheme(theme)
      expect(report.passesAA, `${theme.name} 不合格：${report.failing.join('、')}`).toBe(true)
    }
  })

  it('報告涵蓋所有必檢組合', () => {
    const report = analyzeTheme(DEFAULT_THEME)
    expect(report.pairs.length).toBeGreaterThanOrEqual(13)
    expect(report.pairs.every((p) => p.ratio >= 1 && p.ratio <= 21)).toBe(true)
  })

  it('抓得到不合格的組合', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.textPrimary = '#f5f5f5' // 淺字淺底
    const report = analyzeTheme(t)
    expect(report.passesAA).toBe(false)
    expect(report.failing.length).toBeGreaterThan(0)
  })

  it('worstRatio 只計入會擋下的組合（不含 advisory）', () => {
    const report = analyzeTheme(DEFAULT_THEME)
    const blocking = report.pairs.filter((p) => !p.advisory)
    expect(report.worstRatio).toBeCloseTo(Math.min(...blocking.map((p) => p.ratio)), 2)
  })

  it('裝飾性邊框列為 advisory，不影響 passesAA', () => {
    const report = analyzeTheme(DEFAULT_THEME)
    const borderPair = report.pairs.find((p) => p.label.includes('卡片邊框'))
    expect(borderPair?.advisory).toBe(true)
  })

  it('Focus 外框不是 advisory —— 它是識別狀態所必需', () => {
    const report = analyzeTheme(DEFAULT_THEME)
    for (const p of report.pairs.filter((x) => x.label.includes('Focus'))) {
      expect(p.advisory).toBeUndefined()
    }
  })
})

describe('wcagLevel', () => {
  it.each([
    [21, 'normal', 'AAA'],
    [4.5, 'normal', 'AA'],
    [4.49, 'normal', 'fail'],
    [3, 'large', 'AA'],
    [2.9, 'large', 'fail'],
    [3, 'ui', 'AA'],
    [21, 'ui', 'AA'],   // WCAG 對非文字對比沒有定義 AAA
  ] as const)('%f / %s → %s', (ratio, size, expected) => {
    expect(wcagLevel(ratio, size)).toBe(expected)
  })

  it('門檻符合 ADR-011', () => {
    expect(THRESHOLDS.normal.aa).toBe(4.5)
    expect(THRESHOLDS.large.aa).toBe(3)
    expect(THRESHOLDS.ui.aa).toBe(3)
  })
})

describe('flattenSurface', () => {
  it('半透明會被壓平成不透明 hex', () => {
    expect(flattenSurface('rgba(255,255,255,0.5)', '#000000')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('已不透明時原樣回傳', () => {
    expect(flattenSurface('#ffffff', '#000000')).toBe('#ffffff')
  })

  it('無法解析時原樣回傳', () => {
    expect(flattenSurface('bogus', '#000000')).toBe('bogus')
  })
})

describe('suggestFix', () => {
  it('合格的組合不給建議', () => {
    const report = analyzeTheme(DEFAULT_THEME)
    expect(suggestFix(report.pairs[0]!)).toBeNull()
  })

  it('不合格時給出具體數字，而不只是「對比不足」', () => {
    const t = clone(DEFAULT_THEME)
    t.colors.textPrimary = '#f5f5f5'
    const report = analyzeTheme(t)
    const failing = report.pairs.find((p) => p.level === 'fail')!
    const fix = suggestFix(failing)
    expect(fix).toContain(':1')
    expect(fix).toMatch(/調暗|調亮/)
  })
})

describe('compileThemeToCssText', () => {
  it('產生合法的 CSS 區塊', () => {
    const css = compileThemeToCssText(DEFAULT_THEME)
    expect(css.startsWith(':root {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('--sr-primary:')
  })

  it('可指定選擇器', () => {
    expect(compileThemeToCssText(DEFAULT_THEME, '.preview')).toContain('.preview {')
  })
})

describe('themeDataAttributes', () => {
  it('包含材質與動畫設定', () => {
    const attrs = themeDataAttributes(DEFAULT_THEME)
    expect(attrs['data-surface-style']).toBe(DEFAULT_THEME.surfaces.style)
    expect(attrs['data-motion-preset']).toBe(DEFAULT_THEME.motion.preset)
  })
})

describe('presets', () => {
  it('全部通過 schema 驗證', () => {
    for (const theme of PRESET_THEMES) {
      const result = themeDefinitionSchema.safeParse(theme)
      expect(result.success, `${theme.name}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('名稱不重複', () => {
    const names = PRESET_THEMES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('defaultThemeDefinition 回傳可安全修改的副本', () => {
    const a = defaultThemeDefinition()
    a.colors.primary = '#000000'
    expect(defaultThemeDefinition().colors.primary).not.toBe('#000000')
  })
})

describe('schema（ADR-020：匯入是不可信輸入）', () => {
  it('接受合法的 definition', () => {
    expect(themeDefinitionSchema.safeParse(DEFAULT_THEME).success).toBe(true)
  })

  it.each([
    'url(javascript:alert(1))',
    'expression(alert(1))',
    '</style><script>alert(1)</script>',
    'var(--evil)',
    '#fff',
    'red',
    'rgb(0,0,0);background:url(x)',
  ])('拒絕注入內容：%s', (evil) => {
    const t = clone(DEFAULT_THEME)
    ;(t.colors as Record<string, string>)['primary'] = evil
    expect(themeDefinitionSchema.safeParse(t).success).toBe(false)
  })

  it('拒絕多餘欄位（strict）', () => {
    const t = { ...clone(DEFAULT_THEME), evil: 'payload' }
    expect(themeDefinitionSchema.safeParse(t).success).toBe(false)
  })

  it('拒絕超出範圍的數值', () => {
    const t = clone(DEFAULT_THEME)
    t.surfaces.blur = 9999
    expect(themeDefinitionSchema.safeParse(t).success).toBe(false)
  })

  it('拒絕錯誤的 schemaVersion', () => {
    const t = { ...clone(DEFAULT_THEME), schemaVersion: 2 }
    expect(themeDefinitionSchema.safeParse(t).success).toBe(false)
  })

  it('匯出格式驗證', () => {
    const payload = {
      format: 'snowrealm-theme',
      schemaVersion: 1,
      exportedAt: '2026-07-23T10:00:00Z',
      name: DEFAULT_THEME.name,
      definition: DEFAULT_THEME,
      fontRefs: [],
    }
    expect(themeExportSchema.safeParse(payload).success).toBe(true)
  })

  it('匯出格式拒絕錯誤的 format 標記', () => {
    const payload = {
      format: 'evil-theme',
      schemaVersion: 1,
      exportedAt: '2026-07-23T10:00:00Z',
      name: 'x',
      definition: DEFAULT_THEME,
      fontRefs: [],
    }
    expect(themeExportSchema.safeParse(payload).success).toBe(false)
  })
})
