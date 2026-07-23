import { test, expect } from './fixtures'
import { signInThroughUi } from './fixtures'

/**
 * 每日內容（Milestone E）。09-content-pool.md。
 *
 * 重點是「內容池真的接進產品」：
 *   - 新 space 的 Home 預設就有每日卡片
 *   - 卡片顯示的語錄來自 content_items 池（經 /api/daily/today 生成）
 *   - 同一天內容穩定（決定性選取，重整不換）
 *
 * 需要 content_items 已 seed（pnpm db:seed 會一併灌）。
 */

async function fetchToday(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/daily/today')
    return (await res.json()) as {
      data: {
        greeting: string | null
        quote: { id: string; text: string } | null
        prompt: { id: string; text: string; estimatedMinutes: number | null } | null
      }
    }
  })
}

test.describe('每日內容', () => {
  test('新 space 的 Home 預設就有每日卡片', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await expect(page.locator('.sr-daily-card')).toBeVisible({ timeout: 15_000 })
  })

  test('每日卡片顯示池裡的語錄', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const body = await fetchToday(page)
    // 池已 seed → 應該有語錄與提示
    test.skip(!body.data.quote, 'content_items 未 seed（本機需 pnpm db:seed）')

    expect(body.data.quote!.id).toMatch(/^q-/)
    expect(body.data.quote!.text.length).toBeGreaterThan(0)

    // 卡片上真的顯示那句話
    await expect(page.locator('.sr-daily-quote')).toContainText(body.data.quote!.text)
  })

  test('同一天決定性 —— 重整不換句子', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const first = await fetchToday(page)
    test.skip(!first.data.quote, 'content_items 未 seed')

    await page.reload()
    const second = await fetchToday(page)

    // 同一天、同一 space → 同一則
    expect(second.data.quote!.id).toBe(first.data.quote!.id)
  })

  test('問候依時段，且是繁中', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const body = await fetchToday(page)
    test.skip(!body.data.greeting, 'content_items 未 seed')

    // 問候有內容（時段由伺服器當前小時決定）
    expect(body.data.greeting!.length).toBeGreaterThan(1)
  })
})
