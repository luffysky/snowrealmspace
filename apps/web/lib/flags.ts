import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createAdminClient } from '@snowrealm/db/server'
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from '@snowrealm/shared-types'

/**
 * ADR-018：Feature flag。
 *
 * 讀取用 service role：flag 定義是系統設定，不是使用者資料。
 * 快取 60 秒（in-memory，per instance）。
 */

type FlagMap = Record<FeatureFlagKey, boolean>

const CACHE_TTL_MS = 60_000
let globalCache: { at: number; flags: Partial<FlagMap> } | null = null

function emptyFlags(): FlagMap {
  return Object.fromEntries(FEATURE_FLAG_KEYS.map((k) => [k, false])) as FlagMap
}

async function loadGlobalFlags(): Promise<Partial<FlagMap>> {
  if (globalCache && Date.now() - globalCache.at < CACHE_TTL_MS) return globalCache.flags

  const db = createAdminClient()
  const { data, error } = await db.from('feature_flags').select('key, enabled')

  if (error) {
    // 讀取失敗時一律當作全部關閉。開放比關閉危險得多。
    console.error('[flags] 讀取失敗，全部視為關閉', error.message)
    return {}
  }

  const flags: Partial<FlagMap> = {}
  for (const row of data ?? []) {
    if ((FEATURE_FLAG_KEYS as readonly string[]).includes(row.key)) {
      flags[row.key as FeatureFlagKey] = row.enabled
    }
  }

  globalCache = { at: Date.now(), flags }
  return flags
}

/** 取得某個 space 的完整 flag map（全域預設 + per-space 覆寫）。 */
export const getFlags = cache(async (spaceId?: string): Promise<FlagMap> => {
  const result = { ...emptyFlags(), ...(await loadGlobalFlags()) }

  if (spaceId) {
    const db = createAdminClient()
    const { data } = await db
      .from('space_feature_overrides')
      .select('key, enabled')
      .eq('space_id', spaceId)

    for (const row of data ?? []) {
      if ((FEATURE_FLAG_KEYS as readonly string[]).includes(row.key)) {
        result[row.key as FeatureFlagKey] = row.enabled
      }
    }
  }

  return result
})

export async function isEnabled(key: FeatureFlagKey, spaceId?: string): Promise<boolean> {
  return (await getFlags(spaceId))[key]
}

/**
 * 在頁面或 Route Handler 開頭呼叫。
 *
 * ADR-018：flag 關閉時**路由必須回 404**，不只是隱藏按鈕。
 * 隱藏按鈕但保留可存取的端點是假關閉。
 */
export async function requireFlag(key: FeatureFlagKey, spaceId?: string): Promise<void> {
  if (!(await isEnabled(key, spaceId))) notFound()
}

/** 測試用。 */
export function resetFlagCache(): void {
  globalCache = null
}
