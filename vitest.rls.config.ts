import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    // RLS 測試會建立真實使用者並登入，比單元測試慢
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // 共用同一組測試使用者，平行執行會互相干擾
    fileParallelism: false,
    // 對真實 Supabase 建使用者/登入偶有 timing 抖動 → 重試 2 次穩定 CI（不遮蔽真錯：
    // 真的壞會連重試都失敗）。
    retry: 2,
  },
})
