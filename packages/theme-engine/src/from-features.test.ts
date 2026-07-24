import { describe, it, expect } from 'vitest'
import { draftsFromLocalFeatures } from './from-features.js'
import { contrastRatio } from './color.js'

/** 模擬 asset.process 寫入的巢狀 local_features。 */
function features(colors: Record<string, unknown>) {
  return { colors }
}

describe('draftsFromLocalFeatures', () => {
  it('分析未完成（無主色）回 null，不編假色', () => {
    expect(draftsFromLocalFeatures(null)).toBeNull()
    expect(draftsFromLocalFeatures({ colors: {} })).toBeNull()
  })

  it('產生 3 個變體', () => {
    const r = draftsFromLocalFeatures(features({ dominant: '#8c5870', accent: '#c4536b' }))
    expect(r).not.toBeNull()
    expect(r!.drafts.map((d) => d.variant)).toEqual(['明亮', '柔和', '深色'])
  })

  it('每個變體 textPrimary 對 background ≥ 4.5:1（含對抗性中間調）', () => {
    const palettes = [
      { dominant: '#808080', accent: '#7f7f00' }, // 中灰 + 橄欖，對黑白都難
      { dominant: '#ff0000', accent: '#00ff00' },
      { dominant: '#123456', accent: '#abcdef' },
      { dominant: '#8c5870' },
    ]
    for (const c of palettes) {
      const r = draftsFromLocalFeatures(features(c))!
      for (const { variant, definition } of r.drafts) {
        expect(
          contrastRatio(definition.colors.textPrimary, definition.colors.background),
          `${JSON.stringify(c)} 的 ${variant}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('可重現：同 features 兩次結果完全相同', () => {
    const f = features({ dominant: '#8c5870', accent: '#c4536b', secondary: '#a0708a' })
    expect(draftsFromLocalFeatures(f)).toEqual(draftsFromLocalFeatures(f))
  })

  it('缺 darkest/lightest 時用 NEUTRAL 補，不拋錯', () => {
    const r = draftsFromLocalFeatures(features({ dominant: '#8c5870' }))
    expect(r).not.toBeNull()
    expect(r!.drafts).toHaveLength(3)
  })
})
