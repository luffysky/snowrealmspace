/**
 * 資料庫型別。
 *
 * **不要手動編輯 database.generated.ts。**
 * 改了 migration 之後重新產生：
 *   pnpm exec supabase gen types typescript --local --schema public \
 *     > packages/shared-types/src/database.generated.ts
 *
 * 手寫型別與實際 schema 遲早會漂移，且漂移時 TypeScript 不會警告 ——
 * 它只會讓錯誤的欄位名通過編譯，在執行時才炸。
 */
export type { Json, Database } from './database.generated.js'

import type { Database } from './database.generated.js'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
