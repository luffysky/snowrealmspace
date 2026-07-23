import type { GridItem, MobileItem, Breakpoint } from '@snowrealm/widget-engine'

/**
 * widget_instances.position 是 jsonb，型別上是 unknown。
 *
 * 這裡集中做解析與防禦：schema 演進或手動改資料都可能讓某筆位置缺欄位，
 * 散落各處各自 `as` 斷言會在渲染時炸掉且指不到原因。
 */

export type StoredPosition = {
  desktop?: { x: number; y: number; w: number; h: number }
  tablet?: { x: number; y: number; w: number; h: number }
  mobile?: { order: number }
}

type WidgetRow = { id: string; position: unknown; locked?: boolean | null }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 解析單一斷點的座標。缺欄位時回 null，呼叫端決定要不要補預設。 */
export function readPosition(
  position: unknown,
  breakpoint: Exclude<Breakpoint, 'mobile'>,
): { x: number; y: number; w: number; h: number } | null {
  if (typeof position !== 'object' || position === null) return null
  const slot = (position as Record<string, unknown>)[breakpoint]
  if (typeof slot !== 'object' || slot === null) return null

  const { x, y, w, h } = slot as Record<string, unknown>
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
    return null
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

export function readMobileOrder(position: unknown, fallback: number): number {
  if (typeof position !== 'object' || position === null) return fallback
  const slot = (position as Record<string, unknown>)['mobile']
  if (typeof slot !== 'object' || slot === null) return fallback
  const order = (slot as Record<string, unknown>)['order']
  return isFiniteNumber(order) ? order : fallback
}

/**
 * 把資料庫的列轉成格線項目。
 * 沒有該斷點座標的項目會被略過 —— 呼叫端可用 deriveTabletFromDesktop 補上。
 */
export function readPositions(
  rows: WidgetRow[],
  breakpoint: Exclude<Breakpoint, 'mobile'>,
): GridItem[] {
  const items: GridItem[] = []
  for (const row of rows) {
    const pos = readPosition(row.position, breakpoint)
    if (!pos) continue
    items.push(row.locked ? { id: row.id, ...pos, locked: true } : { id: row.id, ...pos })
  }
  return items
}

export function readMobileItems(rows: WidgetRow[]): MobileItem[] {
  return rows
    .map((row, index) => ({ id: row.id, order: readMobileOrder(row.position, index) }))
    .sort((a, b) => a.order - b.order)
}

/**
 * 只更新指定斷點，保留其他斷點的既有值。
 *
 * 這是「三個斷點各自獨立儲存」的關鍵（06-widget-contract.md §1.1）：
 * 在 desktop 調位置不該動到 tablet 的配置。
 */
export function writePosition(
  existing: unknown,
  breakpoint: Breakpoint,
  value: { x: number; y: number; w: number; h: number } | { order: number },
): StoredPosition {
  const base: StoredPosition =
    typeof existing === 'object' && existing !== null ? { ...(existing as StoredPosition) } : {}

  if (breakpoint === 'mobile') {
    base.mobile = value as { order: number }
  } else {
    base[breakpoint] = value as { x: number; y: number; w: number; h: number }
  }
  return base
}
