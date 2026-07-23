/**
 * 格線佈局：碰撞、推擠、重力壓縮。
 * 見 docs/spec/06-widget-contract.md §1–§2。
 *
 * 全部是純函式 —— 拖曳的正確性不該靠人眼檢查。
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

export type GridConfig = {
  columns: number
  rowHeight: number
  gap: number
}

/** 06-widget-contract.md §1。mobile 不使用格線，是單欄排序。 */
export const GRID: Record<Exclude<Breakpoint, 'mobile'>, GridConfig> = {
  desktop: { columns: 12, rowHeight: 80, gap: 16 },
  tablet: { columns: 8, rowHeight: 80, gap: 16 },
}

export const MOBILE_GAP = 12

export type GridItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** 鎖定的項目不會被推擠，也不能被拖曳。 */
  locked?: boolean
}

export type MobileItem = { id: string; order: number }

export type WidgetPosition = {
  desktop: { x: number; y: number; w: number; h: number }
  tablet: { x: number; y: number; w: number; h: number }
  mobile: { order: number }
}

const MAX_PUSH_DEPTH = 20

export function overlaps(a: GridItem, b: GridItem): boolean {
  if (a.id === b.id) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function findCollisions(item: GridItem, items: GridItem[]): GridItem[] {
  return items.filter((other) => overlaps(item, other))
}

/**
 * 向下推擠。
 *
 * 不採用「交換位置」：當兩個 widget 大小不同時，交換的結果無法預測 ——
 * 使用者拖一個大卡片到小卡片上，小卡片該去哪裡沒有直覺的答案。
 * 往下推則永遠是可預期的。
 *
 * 遞迴深度上限 20；超過表示佈局過於擁擠，拒絕該次移動並回彈。
 */
export function resolveCollisions(
  items: GridItem[],
  movedId: string,
  depth = 0,
): GridItem[] | null {
  if (depth > MAX_PUSH_DEPTH) return null

  const result = items.map((i) => ({ ...i }))
  const moved = result.find((i) => i.id === movedId)
  if (!moved) return result

  const collisions = findCollisions(moved, result)
  if (collisions.length === 0) return result

  for (const other of collisions) {
    // 鎖定的項目不讓路 —— 這次移動不合法
    if (other.locked) return null

    const target = result.find((i) => i.id === other.id)!
    target.y = moved.y + moved.h

    const next = resolveCollisions(result, target.id, depth + 1)
    if (!next) return null

    // 把遞迴結果寫回
    for (const n of next) {
      const slot = result.find((i) => i.id === n.id)!
      slot.x = n.x
      slot.y = n.y
    }
  }

  return result
}

/**
 * 重力壓縮：在不碰撞的前提下所有項目盡量往上。
 *
 * 沒有這一步，佈局會出現用拖曳消不掉的空洞 ——
 * 刪掉中間一個 widget 後，下方的不會自動遞補。
 */
export function compactLayout(items: GridItem[], _columns?: number): GridItem[] {
  // 依 y 再依 x 排序，確保處理順序穩定（同樣輸入必得同樣輸出）
  const sorted = [...items]
    .map((i) => ({ ...i }))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const placed: GridItem[] = []

  for (const item of sorted) {
    if (item.locked) {
      placed.push(item)
      continue
    }
    let y = item.y
    // 一路往上試，直到再上去就會撞到
    while (y > 0) {
      const candidate = { ...item, y: y - 1 }
      if (placed.some((p) => overlaps(candidate, p))) break
      y--
    }
    item.y = y
    placed.push(item)
  }

  return placed.sort((a, b) => a.y - b.y || a.x - b.x)
}

export type SizeBounds = { minW: number; minH: number; maxW: number; maxH: number }

/**
 * 驗證單一項目是否合法。
 * 伺服器端必須呼叫 —— 靜默修正會讓前後端認知不一致（06-widget-contract.md §2.3）。
 */
export function validateItem(
  item: GridItem,
  bounds: SizeBounds,
  columns: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(item.x) || !Number.isInteger(item.y)) {
    return { ok: false, reason: '座標必須是整數' }
  }
  if (item.x < 0 || item.y < 0) return { ok: false, reason: '座標不可為負' }
  if (item.w < bounds.minW) return { ok: false, reason: `寬度不可小於 ${bounds.minW}` }
  if (item.w > bounds.maxW) return { ok: false, reason: `寬度不可大於 ${bounds.maxW}` }
  if (item.h < bounds.minH) return { ok: false, reason: `高度不可小於 ${bounds.minH}` }
  if (item.h > bounds.maxH) return { ok: false, reason: `高度不可大於 ${bounds.maxH}` }
  if (item.x + item.w > columns) {
    return { ok: false, reason: `超出格線範圍（共 ${columns} 欄）` }
  }
  return { ok: true }
}

export function validateLayout(
  items: GridItem[],
  columns: number,
): { ok: true } | { ok: false; reason: string } {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i]!, items[j]!)) {
        return { ok: false, reason: `${items[i]!.id} 與 ${items[j]!.id} 重疊` }
      }
    }
  }
  for (const item of items) {
    if (item.x + item.w > columns) {
      return { ok: false, reason: `${item.id} 超出格線範圍` }
    }
  }
  return { ok: true }
}

/**
 * 從 desktop 推導 tablet。
 * 06-widget-contract.md §1.2：推導結果會立即持久化，之後不再重新推導。
 */
export function deriveTabletFromDesktop(items: GridItem[]): GridItem[] {
  const ratio = GRID.tablet.columns / GRID.desktop.columns
  const derived = items.map((i) => {
    const w = Math.min(Math.max(1, Math.ceil(i.w * ratio)), GRID.tablet.columns)
    const x = Math.min(Math.max(0, Math.round(i.x * ratio)), GRID.tablet.columns - w)
    return { ...i, x, y: i.y, w, h: i.h }
  })

  // 推導後可能產生重疊，逐一往下讓開再壓縮
  const resolved: GridItem[] = []
  for (const item of [...derived].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const placed = { ...item }
    while (resolved.some((r) => overlaps(placed, r))) placed.y++
    resolved.push(placed)
  }

  return compactLayout(resolved)
}

/** 從 desktop 推導 mobile 的單欄順序。 */
export function deriveMobileFromDesktop(items: GridItem[]): MobileItem[] {
  return [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item, index) => ({ id: item.id, order: index }))
}

/** 像素尺寸（06-widget-contract.md §1）。 */
export function pixelSize(
  item: Pick<GridItem, 'w' | 'h'>,
  containerWidth: number,
  config: GridConfig,
): { width: number; height: number } {
  const columnWidth = (containerWidth - config.gap * (config.columns - 1)) / config.columns
  return {
    width: item.w * columnWidth + (item.w - 1) * config.gap,
    height: item.h * config.rowHeight + (item.h - 1) * config.gap,
  }
}

/** 依視窗寬度判斷斷點。 */
export function breakpointForWidth(width: number): Breakpoint {
  if (width >= 1280) return 'desktop'
  if (width >= 768) return 'tablet'
  return 'mobile'
}

/** 佈局的總高度（列數），用於容器高度計算。 */
export function layoutHeight(items: GridItem[]): number {
  return items.reduce((max, i) => Math.max(max, i.y + i.h), 0)
}

/**
 * 依給定順序重新排版，像文字換行一樣由左至右、由上而下填入。
 *
 * 用於鍵盤重新排序。**不能用「交換座標」** ——
 * 兩個寬度不同的項目互換位置會產生重疊：
 * 例如寬 4 的項目換到 x=4，就會壓到原本在 x=7 的項目。
 * 重新流動則永遠產生合法佈局。
 */
export function reflow(ordered: GridItem[], columns: number): GridItem[] {
  const placed: GridItem[] = []
  let cursorX = 0
  let rowY = 0
  let rowHeight = 0

  for (const item of ordered) {
    const width = Math.min(item.w, columns)

    // 這一列放不下就換行
    if (cursorX + width > columns) {
      rowY += rowHeight
      cursorX = 0
      rowHeight = 0
    }

    placed.push({ ...item, x: cursorX, y: rowY, w: width })
    cursorX += width
    rowHeight = Math.max(rowHeight, item.h)
  }

  return compactLayout(placed)
}

/**
 * 在閱讀順序中把某個項目往前 / 往後移一格，然後重新排版。
 * 回傳 null 表示已經在頭或尾。
 */
export function reorderByOne(
  items: GridItem[],
  id: string,
  direction: -1 | 1,
  columns: number,
): GridItem[] | null {
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const index = ordered.findIndex((i) => i.id === id)
  if (index < 0) return null

  const target = index + direction
  if (target < 0 || target >= ordered.length) return null
  if (ordered[target]?.locked || ordered[index]?.locked) return null

  const next = [...ordered]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)

  const result = reflow(next, columns)
  return validateLayout(result, columns).ok ? result : null
}
