/**
 * Client-safe 的純型別與常數（無 node:crypto / db import）。
 *
 * client component 只能從這裡 import（`@snowrealm/daily-engine/shared`），
 * 不能碰 barrel（index.ts 會拉進 service.ts 的 node:crypto，client bundle 會炸）。
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'special' | 'anniversary'

export type SurpriseView =
  | { state: 'available' }
  | { state: 'opened'; rarity: Rarity; label: string; text: string; openedAt: string }
  | { state: 'empty' }

export type ArchivedSurprise = {
  id: string
  rarity: Rarity
  label: string
  text: string
  openedAt: string
  favorited: boolean
}

export type Insight = {
  id: string
  type: string
  title: string
  statement: string
  evidence: { metric?: string; value?: number; sourceIds: string[] }
  confidence: number
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

/** 每日盒子的稀有度機率。special / anniversary 是條件觸發，不進每日隨機。 */
export const DAILY_WEIGHTS: Record<string, number> = {
  common: 64,
  uncommon: 26,
  rare: 10,
}

/** 稀有度保底：連續這麼多盒沒出 rare，下一盒強制 rare（對玩家公開）。 */
export const PITY_THRESHOLD = 15

const RARITY_LABEL: Record<Rarity, string> = {
  common: '平凡',
  uncommon: '少見',
  rare: '稀有',
  special: '特別',
  anniversary: '週年',
}

export function rarityLabel(r: string): string {
  return RARITY_LABEL[r as Rarity] ?? r
}
