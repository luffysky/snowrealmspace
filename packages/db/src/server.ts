import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { serverEnv } from '@snowrealm/shared-types'
import type { Database } from '@snowrealm/shared-types'

/**
 * Db 用 createClient 的實際回傳型別，而不是手寫 SupabaseClient<Database>。
 * 手寫的泛型參數會隨 supabase-js 版本漂移，在 exactOptionalPropertyTypes 下
 * 產生難以理解的不相容錯誤。
 */
export type Db = ReturnType<typeof createClient<Database>>

/** @supabase/ssr 的 cookie 介面（避免 packages/db 依賴 next）。 */
export type CookieRecord = { name: string; value: string }
export type CookieSetOptions = Record<string, unknown>
export type CookieAdapter = {
  getAll(): CookieRecord[] | Promise<CookieRecord[]>
  setAll(cookies: { name: string; value: string; options?: CookieSetOptions }[]): void | Promise<void>
}

/**
 * 使用者身分的 client。**所有查詢都受 RLS 約束**。
 * 一般 feature code 應該用這個，而不是 service role。
 */
export function createUserClient(cookies: CookieAdapter): Db {
  const env = serverEnv()
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: (toSet) => {
          try {
            void cookies.setAll(toSet)
          } catch {
            // Server Component 中無法寫 cookie；middleware 會負責刷新 session。
            // 這個 catch 是 @supabase/ssr 官方建議的處理方式，不是掩蓋錯誤。
          }
        },
      },
    },
  ) as unknown as Db
}

let cachedAdmin: Db | null = null

/**
 * Service role client。**繞過所有 RLS。**
 *
 * 只用於：
 *   - 邀請驗證與 space 佈建（使用者此時還不是任何 space 的成員）
 *   - 寫入 activity_events / audit_logs（這兩張表對 client 唯讀）
 *   - Worker 的背景工作
 *   - Cron 端點
 *
 * 絕不可用於處理一般使用者請求 —— 那會讓 RLS 形同虛設。
 */
export function createAdminClient(): Db {
  if (cachedAdmin) return cachedAdmin
  const env = serverEnv()
  cachedAdmin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return cachedAdmin
}

/** 測試用：以特定 access token 建立受 RLS 約束的 client。 */
export function createTokenClient(accessToken: string): Db {
  const env = serverEnv()
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  )
}

/** 測試用：清除 admin client 快取。 */
export function resetAdminClient(): void {
  cachedAdmin = null
}
