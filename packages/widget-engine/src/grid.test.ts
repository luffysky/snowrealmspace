import { describe, it, expect } from 'vitest'
import {
  GRID,
  overlaps,
  findCollisions,
  resolveCollisions,
  compactLayout,
  validateItem,
  validateLayout,
  deriveTabletFromDesktop,
  deriveMobileFromDesktop,
  pixelSize,
  breakpointForWidth,
  layoutHeight,
  reflow,
  reorderByOne,
  type GridItem,
} from './grid.js'

const bounds = { minW: 1, minH: 1, maxW: 12, maxH: 8 }

describe('overlaps', () => {
  it('相鄰但不重疊', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 2, y: 0, w: 2, h: 2 })).toBe(
      false,
    )
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 0, y: 2, w: 2, h: 2 })).toBe(
      false,
    )
  })

  it('部分重疊', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 3, h: 3 }, { id: 'b', x: 2, y: 2, w: 3, h: 3 })).toBe(
      true,
    )
  })

  it('完全包含', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 6, h: 6 }, { id: 'b', x: 1, y: 1, w: 2, h: 2 })).toBe(
      true,
    )
  })

  it('自己不與自己重疊', () => {
    const item = { id: 'a', x: 0, y: 0, w: 2, h: 2 }
    expect(overlaps(item, { ...item })).toBe(false)
  })
})

describe('findCollisions', () => {
  it('找出所有相撞的項目', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', x: 2, y: 2, w: 2, h: 2 },
      { id: 'c', x: 8, y: 0, w: 2, h: 2 },
    ]
    expect(findCollisions(items[0]!, items).map((i) => i.id)).toEqual(['b'])
  })

  it('無碰撞時回空陣列', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'b', x: 4, y: 0, w: 2, h: 2 },
    ]
    expect(findCollisions(items[0]!, items)).toEqual([])
  })
})

describe('resolveCollisions（向下推擠）', () => {
  it('把被撞的項目往下推', () => {
    const items: GridItem[] = [
      { id: 'moved', x: 0, y: 0, w: 4, h: 2 },
      { id: 'other', x: 0, y: 1, w: 4, h: 2 },
    ]
    const result = resolveCollisions(items, 'moved')!
    expect(result.find((i) => i.id === 'other')!.y).toBe(2)
  })

  it('連鎖推擠', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 1, w: 4, h: 2 },
      { id: 'c', x: 0, y: 2, w: 4, h: 2 },
    ]
    const result = resolveCollisions(items, 'a')!
    expect(validateLayout(result, 12).ok).toBe(true)
  })

  it('無碰撞時原樣回傳', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'b', x: 4, y: 0, w: 2, h: 2 },
    ]
    expect(resolveCollisions(items, 'a')).toEqual(items)
  })

  it('不修改輸入', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 1, w: 4, h: 2 },
    ]
    const snapshot = JSON.stringify(items)
    resolveCollisions(items, 'a')
    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it('鎖定的項目不讓路 —— 該次移動不合法', () => {
    const items: GridItem[] = [
      { id: 'moved', x: 0, y: 0, w: 4, h: 2 },
      { id: 'locked', x: 0, y: 1, w: 4, h: 2, locked: true },
    ]
    expect(resolveCollisions(items, 'moved')).toBeNull()
  })

  it('找不到 movedId 時原樣回傳', () => {
    const items: GridItem[] = [{ id: 'a', x: 0, y: 0, w: 2, h: 2 }]
    expect(resolveCollisions(items, 'nonexistent')).toEqual(items)
  })

  it('推擠結果無重疊', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 3, w: 6, h: 3 },
      { id: 'b', x: 0, y: 0, w: 3, h: 2 },
      { id: 'c', x: 3, y: 0, w: 3, h: 2 },
      { id: 'd', x: 0, y: 2, w: 6, h: 2 },
    ]
    const result = resolveCollisions(items, 'a')
    if (result) expect(validateLayout(result, 12).ok).toBe(true)
  })
})

describe('compactLayout（重力壓縮）', () => {
  it('把懸空的項目往上移', () => {
    const result = compactLayout([{ id: 'a', x: 0, y: 5, w: 2, h: 2 }])
    expect(result[0]!.y).toBe(0)
  })

  it('消除中間的空洞', () => {
    const result = compactLayout([
      { id: 'a', x: 0, y: 0, w: 12, h: 2 },
      { id: 'b', x: 0, y: 6, w: 12, h: 2 },
    ])
    expect(result.find((i) => i.id === 'b')!.y).toBe(2)
  })

  it('不同欄的項目各自往上，互不影響', () => {
    const result = compactLayout([
      { id: 'a', x: 0, y: 3, w: 4, h: 2 },
      { id: 'b', x: 6, y: 7, w: 4, h: 2 },
    ])
    expect(result.find((i) => i.id === 'a')!.y).toBe(0)
    expect(result.find((i) => i.id === 'b')!.y).toBe(0)
  })

  it('壓縮後不產生重疊', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 0, y: 4, w: 6, h: 2 },
      { id: 'c', x: 6, y: 2, w: 6, h: 3 },
      { id: 'd', x: 0, y: 9, w: 12, h: 2 },
    ]
    expect(validateLayout(compactLayout(items), 12).ok).toBe(true)
  })

  it('空佈局不拋錯', () => {
    expect(compactLayout([])).toEqual([])
  })

  it('已經壓縮過的佈局不變（冪等）', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ]
    const once = compactLayout(items)
    expect(compactLayout(once)).toEqual(once)
  })

  it('鎖定的項目不被移動', () => {
    const result = compactLayout([{ id: 'a', x: 0, y: 5, w: 2, h: 2, locked: true }])
    expect(result[0]!.y).toBe(5)
  })

  it('確定性：相同輸入必得相同輸出', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 4, w: 4, h: 2 },
      { id: 'b', x: 4, y: 2, w: 4, h: 2 },
      { id: 'c', x: 8, y: 6, w: 4, h: 2 },
    ]
    expect(compactLayout(items)).toEqual(compactLayout(items))
  })

  it('不修改輸入', () => {
    const items: GridItem[] = [{ id: 'a', x: 0, y: 5, w: 2, h: 2 }]
    const snapshot = JSON.stringify(items)
    compactLayout(items)
    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it('鋸齒狀佈局也能正確壓縮', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 2, w: 3, h: 2 },
      { id: 'b', x: 3, y: 0, w: 3, h: 4 },
      { id: 'c', x: 0, y: 6, w: 3, h: 2 },
      { id: 'd', x: 6, y: 3, w: 6, h: 2 },
    ]
    const result = compactLayout(items)
    expect(validateLayout(result, 12).ok).toBe(true)
    expect(Math.min(...result.map((i) => i.y))).toBe(0)
  })
})

describe('validateItem', () => {
  it('合法項目通過', () => {
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 4, h: 2 }, bounds, 12).ok).toBe(true)
  })

  it.each([
    [{ id: 'a', x: -1, y: 0, w: 2, h: 2 }, '座標不可為負'],
    [{ id: 'a', x: 0, y: -1, w: 2, h: 2 }, '座標不可為負'],
    [{ id: 'a', x: 0.5, y: 0, w: 2, h: 2 }, '座標必須是整數'],
    [{ id: 'a', x: 10, y: 0, w: 4, h: 2 }, '超出格線範圍'],
  ])('拒絕不合法的項目：%o', (item, reasonPart) => {
    const result = validateItem(item, bounds, 12)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(reasonPart)
  })

  it('拒絕超出 min/max 的尺寸', () => {
    const tight = { minW: 2, minH: 2, maxW: 4, maxH: 4 }
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 1, h: 2 }, tight, 12).ok).toBe(false)
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 5, h: 2 }, tight, 12).ok).toBe(false)
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 2, h: 1 }, tight, 12).ok).toBe(false)
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 2, h: 5 }, tight, 12).ok).toBe(false)
  })

  it('剛好填滿整列是合法的', () => {
    expect(validateItem({ id: 'a', x: 0, y: 0, w: 12, h: 2 }, bounds, 12).ok).toBe(true)
  })
})

describe('validateLayout', () => {
  it('無重疊時通過', () => {
    expect(
      validateLayout(
        [
          { id: 'a', x: 0, y: 0, w: 6, h: 2 },
          { id: 'b', x: 6, y: 0, w: 6, h: 2 },
        ],
        12,
      ).ok,
    ).toBe(true)
  })

  it('抓得到重疊', () => {
    const result = validateLayout(
      [
        { id: 'a', x: 0, y: 0, w: 6, h: 2 },
        { id: 'b', x: 3, y: 0, w: 6, h: 2 },
      ],
      12,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('重疊')
  })

  it('抓得到超出範圍', () => {
    expect(validateLayout([{ id: 'a', x: 8, y: 0, w: 6, h: 2 }], 12).ok).toBe(false)
  })
})

describe('deriveTabletFromDesktop', () => {
  it('12 欄縮成 8 欄後仍在範圍內', () => {
    const desktop: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ]
    const tablet = deriveTabletFromDesktop(desktop)
    expect(validateLayout(tablet, GRID.tablet.columns).ok).toBe(true)
  })

  it('滿寬的項目在 tablet 仍是滿寬', () => {
    const tablet = deriveTabletFromDesktop([{ id: 'a', x: 0, y: 0, w: 12, h: 2 }])
    expect(tablet[0]!.w).toBe(GRID.tablet.columns)
  })

  it('寬度至少為 1（不會縮成 0）', () => {
    const tablet = deriveTabletFromDesktop([{ id: 'a', x: 0, y: 0, w: 1, h: 2 }])
    expect(tablet[0]!.w).toBeGreaterThanOrEqual(1)
  })

  it('複雜佈局推導後無重疊', () => {
    const desktop: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
      { id: 'c', x: 8, y: 0, w: 4, h: 2 },
      { id: 'd', x: 0, y: 2, w: 6, h: 3 },
      { id: 'e', x: 6, y: 2, w: 6, h: 3 },
    ]
    const tablet = deriveTabletFromDesktop(desktop)
    expect(validateLayout(tablet, GRID.tablet.columns).ok).toBe(true)
    expect(tablet).toHaveLength(5)
  })

  it('確定性', () => {
    const desktop: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 5, h: 2 },
      { id: 'b', x: 5, y: 0, w: 7, h: 2 },
    ]
    expect(deriveTabletFromDesktop(desktop)).toEqual(deriveTabletFromDesktop(desktop))
  })
})

describe('deriveMobileFromDesktop', () => {
  it('依 y 再依 x 排序', () => {
    const mobile = deriveMobileFromDesktop([
      { id: 'c', x: 6, y: 2, w: 6, h: 2 },
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ])
    expect(mobile.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(mobile.map((m) => m.order)).toEqual([0, 1, 2])
  })

  it('order 連續無跳號', () => {
    const mobile = deriveMobileFromDesktop([
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 5, w: 4, h: 2 },
      { id: 'c', x: 8, y: 9, w: 4, h: 2 },
    ])
    expect(mobile.map((m) => m.order)).toEqual([0, 1, 2])
  })
})

describe('pixelSize', () => {
  it('滿寬時等於容器寬度', () => {
    const { width } = pixelSize({ w: 12, h: 1 }, 1200, GRID.desktop)
    expect(width).toBeCloseTo(1200, 5)
  })

  it('半寬約為容器一半（扣掉 gap）', () => {
    const { width } = pixelSize({ w: 6, h: 1 }, 1200, GRID.desktop)
    expect(width).toBeLessThan(600)
    expect(width).toBeGreaterThan(560)
  })

  it('高度含 gap', () => {
    const { height } = pixelSize({ w: 1, h: 2 }, 1200, GRID.desktop)
    expect(height).toBe(GRID.desktop.rowHeight * 2 + GRID.desktop.gap)
  })
})

describe('breakpointForWidth', () => {
  it.each([
    [1920, 'desktop'],
    [1280, 'desktop'],
    [1279, 'tablet'],
    [768, 'tablet'],
    [767, 'mobile'],
    [375, 'mobile'],
  ] as const)('%ipx → %s', (width, expected) => {
    expect(breakpointForWidth(width)).toBe(expected)
  })
})

describe('layoutHeight', () => {
  it('回傳最底部的列數', () => {
    expect(
      layoutHeight([
        { id: 'a', x: 0, y: 0, w: 4, h: 2 },
        { id: 'b', x: 4, y: 3, w: 4, h: 4 },
      ]),
    ).toBe(7)
  })

  it('空佈局為 0', () => {
    expect(layoutHeight([])).toBe(0)
  })
})

describe('reflow', () => {
  it('像文字換行一樣填入，超過欄數就換行', () => {
    const result = reflow(
      [
        { id: 'a', x: 0, y: 0, w: 8, h: 2 },
        { id: 'b', x: 0, y: 0, w: 6, h: 2 },
      ],
      12,
    )
    expect(result.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 0 })
    // 8 + 6 > 12，b 換到下一列
    expect(result.find((i) => i.id === 'b')!.y).toBeGreaterThan(0)
  })

  it('結果永遠合法，不重疊', () => {
    const items: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 3, h: 2 },
      { id: 'c', x: 7, y: 0, w: 5, h: 3 },
      { id: 'd', x: 0, y: 3, w: 12, h: 2 },
    ]
    expect(validateLayout(reflow(items, 12), 12).ok).toBe(true)
  })

  it('寬度超過欄數時會被截到欄數', () => {
    expect(reflow([{ id: 'a', x: 0, y: 0, w: 99, h: 2 }], 12)[0]!.w).toBe(12)
  })

  it('保留高度', () => {
    const result = reflow([{ id: 'a', x: 0, y: 0, w: 4, h: 5 }], 12)
    expect(result[0]!.h).toBe(5)
  })

  it('空輸入回空陣列', () => {
    expect(reflow([], 12)).toEqual([])
  })
})

describe('reorderByOne', () => {
  /**
   * 這組測試對應一個實際踩到的 bug：
   * 用「交換座標」實作重新排序時，寬度不同的兩個項目互換會產生重疊，
   * 導致驗證失敗、按鍵完全沒反應。
   */
  const layout: GridItem[] = [
    { id: 'a', x: 0, y: 0, w: 4, h: 2 },
    { id: 'b', x: 4, y: 0, w: 3, h: 2 },
    { id: 'c', x: 7, y: 0, w: 5, h: 3 },
  ]

  it('往後移一格', () => {
    const result = reorderByOne(layout, 'a', 1, 12)!
    expect(result).not.toBeNull()
    const ordered = [...result].sort((x, y) => x.y - y.y || x.x - y.x)
    expect(ordered.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('往前移一格', () => {
    const result = reorderByOne(layout, 'c', -1, 12)!
    const ordered = [...result].sort((x, y) => x.y - y.y || x.x - y.x)
    expect(ordered.map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('寬度不同的項目互換也不會重疊', () => {
    for (const id of ['a', 'b', 'c']) {
      for (const dir of [-1, 1] as const) {
        const result = reorderByOne(layout, id, dir, 12)
        if (result) {
          expect(validateLayout(result, 12).ok, `${id} 往 ${dir}`).toBe(true)
        }
      }
    }
  })

  it('已在最前面時往前移回 null', () => {
    expect(reorderByOne(layout, 'a', -1, 12)).toBeNull()
  })

  it('已在最後面時往後移回 null', () => {
    expect(reorderByOne(layout, 'c', 1, 12)).toBeNull()
  })

  it('鎖定的項目不參與重新排序', () => {
    const locked: GridItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 3, h: 2, locked: true },
    ]
    expect(reorderByOne(locked, 'a', 1, 12)).toBeNull()
  })

  it('找不到 id 時回 null', () => {
    expect(reorderByOne(layout, 'missing', 1, 12)).toBeNull()
  })

  it('保留每個項目的尺寸', () => {
    const result = reorderByOne(layout, 'a', 1, 12)!
    for (const original of layout) {
      const moved = result.find((i) => i.id === original.id)!
      expect(moved.w, original.id).toBe(original.w)
      expect(moved.h, original.id).toBe(original.h)
    }
  })
})
