import { describe, it, expect } from 'vitest'
import {
  SCENES,
  SCENE_CATEGORIES,
  scenesByCategory,
  getScene,
  type SceneCategory,
} from './scenes'
import { LOTTIE_SCENES } from './lottie-scenes'

const CATEGORY_SET = new Set<SceneCategory>(SCENE_CATEGORIES)

describe('scenes 分類（背景商店）', () => {
  it('每個場景都剛好有一個合法分類', () => {
    for (const sc of SCENES) {
      expect(typeof sc.category, `${sc.id} 缺 category`).toBe('string')
      expect(CATEGORY_SET.has(sc.category), `${sc.id} 分類非法：${sc.category}`).toBe(true)
    }
  })

  it('場景 id 不重複', () => {
    const ids = SCENES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('scenesByCategory 為互斥且完整的分割（各類相加 = 全部）', () => {
    let sum = 0
    for (const cat of SCENE_CATEGORIES) {
      const list = scenesByCategory(cat)
      for (const sc of list) expect(sc.category).toBe(cat)
      sum += list.length
    }
    expect(sum).toBe(SCENES.length)
  })

  it('每個分類至少有一個場景（沒有空分頁）', () => {
    for (const cat of SCENE_CATEGORIES) {
      expect(scenesByCategory(cat).length, `${cat} 是空分類`).toBeGreaterThan(0)
    }
  })

  it('getScene 依 id 取回、未知 id 回 null', () => {
    expect(getScene('snow-soft')?.id).toBe('snow-soft')
    expect(getScene('does-not-exist')).toBeNull()
    expect(getScene(null)).toBeNull()
  })

  it('每個 Lottie 背景也用同一組分類詞彙', () => {
    expect(LOTTIE_SCENES.length).toBeGreaterThan(0)
    for (const l of LOTTIE_SCENES) {
      expect(CATEGORY_SET.has(l.category), `${l.id} 分類非法：${l.category}`).toBe(true)
    }
  })
})
