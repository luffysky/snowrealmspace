import { defineConfig } from 'vitest/config'

/**
 * 單元測試與覆蓋率門檻。見 docs/spec/11-engineering-setup.md §7。
 *
 * 門檻依套件性質分級：純函式套件（未來的 theme-engine / widget-engine）
 * 測試成本低而回報高，門檻拉到 95%；含 I/O 的套件務實一些。
 *
 * 只涵蓋 packages/* —— apps/* 的驗證靠 E2E 與 RLS 測試，
 * 對 Server Component 追求行覆蓋率會逼出大量無意義的 mock。
 */
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'supabase/tests/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/index.ts', // 純 re-export，覆蓋率無意義
        '**/*.generated.ts',
        // 這三支是對外部服務的薄封裝，價值在型別與介面，
        // 行為驗證靠 RLS 測試與 verify 腳本，不靠單元測試的 mock。
        'packages/db/src/server.ts',
        'packages/db/src/provisioning.ts',
        'packages/storage/src/r2.ts',
        'packages/analytics/src/emit.ts',
        'packages/analytics/src/audit.ts',
      ],
      thresholds: {
        // 全域下限
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,

        // 純函式套件：測試便宜，門檻拉高
        'packages/shared-types/src/domain.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'packages/validation/src/common.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        // 主題引擎是視覺正確性的基礎，且全是純函式 —— 測試便宜，門檻拉高
        'packages/theme-engine/src/color.ts': {
          lines: 95, functions: 95, branches: 90, statements: 95,
        },
        'packages/theme-engine/src/contrast.ts': {
          lines: 95, functions: 95, branches: 90, statements: 95,
        },
        'packages/theme-engine/src/compile.ts': {
          lines: 95, functions: 95, branches: 85, statements: 95,
        },
        'packages/theme-engine/src/palette.ts': {
          lines: 90, functions: 90, branches: 80, statements: 90,
        },
        // 格線正確性直接影響拖曳體驗，且是純函式
        'packages/widget-engine/src/grid.ts': {
          lines: 95, functions: 95, branches: 90, statements: 95,
        },
        'packages/storage/src/adapter.ts': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
})
