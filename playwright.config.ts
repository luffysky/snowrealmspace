import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import { E2E_PORT, E2E_BASE_URL } from './e2e/config'

config({ path: '.env.local' })

/**
 * E2E 跑在自己的 port 與 build 目錄上，與開發用的 dev server 完全隔離。
 *
 * 為什麼不共用 dev server：
 *   1. `next build` 會覆寫 dev server 的 .next，讓 CSS chunk 變 404 ——
 *      頁面還在但完全沒樣式，測試會以難以理解的方式失敗。
 *   2. dev overlay 會注入自己的 role="alert"，干擾語意查詢。
 *   3. production build 才是使用者實際拿到的東西。
 */
const BASE_URL = E2E_BASE_URL

/**
 * E2E。見 docs/spec/11-engineering-setup.md §7。
 *
 * 對照 v1.0 §45.2 的 14 條關鍵流程 —— Milestone A 只有前兩條
 * （Onboarding / 隱私與刪除控制的一部分）可測，其餘隨後續 Milestone 補上。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // 共用一組測試使用者與同一個本機 stack
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // v1.0 §55 要求 Desktop 與 Mobile Web 都可用
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'pnpm run e2e:server',
    url: BASE_URL,
    // 一律用自己起的 production server，不沿用任何既有行程 ——
    // 沿用的話就無法保證測到的是目前這份程式碼。
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      NEXT_PUBLIC_APP_URL: BASE_URL,
      PORT: String(E2E_PORT),
    },
  },
})
