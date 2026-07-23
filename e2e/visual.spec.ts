import { test, expect } from './fixtures'
import { signInThroughUi } from './fixtures'

/**
 * 視覺回歸（visual regression）。@visual
 *
 * ## 為什麼是 opt-in，不進主要 CI 流程
 *
 * 像素級截圖比對本質上對環境敏感：
 *   - 字型 rasterization 在 Windows 與 Linux CI 上不同
 *   - **字體要先 seed** 才會用到自架字體，CI 不跑那條管線（見 fonts.spec.ts）→
 *     CI 的文字用系統 fallback，與本機截圖必然不同
 *   - 抗鋸齒、次像素渲染在不同 GPU / 驅動上有差異
 *
 * 所以基準圖（baseline）**必須在固定環境產生**，然後只在同一環境比對。
 * 硬塞進跨平台 CI 只會不停 flaky —— 那正是「永遠在紅但沒人信」的來源。
 *
 * 用法：
 *   pnpm test:visual                 # 比對現有基準
 *   pnpm test:visual --update-snapshots   # 產生 / 更新基準（換 UI 後跑）
 *
 * 主要的 test:e2e 用 --grep-invert @visual 排除這一組。
 *
 * ## 降低雜訊的措施
 *
 * - 關閉動畫（animations: 'disabled'）→ 不會截到轉場中間幀
 * - 遮蔽會變動的區域（背景、時間）
 * - maxDiffPixelRatio 容忍極小差異，避免單一像素造成假紅
 */

test.describe('視覺回歸 @visual', () => {
  // 只在明確要求時跑，避免混進一般 E2E
  test.skip(!process.env.VISUAL, '設定 VISUAL=1 才執行視覺回歸')

  test('登入頁', async ({ page }) => {
    await page.goto('/login')
    // 等字體與樣式穩定
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('login.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.005,
      fullPage: true,
    })
  })

  test('邀請無效頁', async ({ page }) => {
    await page.goto('/invite?token=invalid')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('invite-invalid.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.005,
      fullPage: true,
    })
  })

  test('Home（預設主題）', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
      fullPage: true,
      // 背景層會播放/輪播，遮掉才不會每次都不同
      mask: [page.locator('.sr-bg-layer')],
    })
  })

  test('Theme Studio', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('theme-studio.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
      fullPage: true,
      // 字體樣張依 seed 狀態不同，遮掉
      mask: [page.locator('.sr-font-sample')],
    })
  })
})
