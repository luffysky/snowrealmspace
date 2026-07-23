import { test, expect } from '@playwright/test'
import { E2E_BASE_URL } from './config'

/**
 * 站台密碼閘門。尚未對外開放時擋住所有人。
 *
 * 這裡刻意用**乾淨的 browser context**（不帶 fixtures 預塞的通過 cookie），
 * 才測得到「沒通過閘門會被擋」。用 base test，不是帶 cookie 的 fixtures test。
 */

test.describe('站台密碼閘門', () => {
  test('沒通過閘門，任何頁都被導到 /gate', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/gate/)
    await expect(page.getByText('這裡還沒對外開放')).toBeVisible()
  })

  test('密碼錯 → 留在閘門並說明', async ({ page }) => {
    await page.goto('/gate')
    await page.getByPlaceholder('輸入密碼').fill('wrong-password')
    await page.getByRole('button', { name: '進入' }).click()
    // role=alert 會同時匹配 Next 的路由播報器，指定錯誤訊息本身
    await expect(page.locator('.sr-message-error')).toContainText('密碼不對')
    await expect(page).toHaveURL(/\/gate/)
  })

  test('密碼對 → 放行進站，之後不再被擋', async ({ page }) => {
    await page.goto('/gate')
    await page.getByPlaceholder('輸入密碼').fill('nami0724nami0724')
    await page.getByRole('button', { name: '進入' }).click()

    // 放行後導離 /gate（未登入會落在 /login）
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    // 再訪其他頁不會再被閘門擋（cookie 已在）
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page).not.toHaveURL(/\/gate/)
  })

  test('API 也被閘門擋（未通過時不給打）', async ({ request }) => {
    // 乾淨 request context 沒有通過 cookie
    const res = await request.get(`${E2E_BASE_URL}/api/fonts`, { maxRedirects: 0 }).catch(() => null)
    // 被導向 /gate（3xx）或擋下，總之不是 200 正常回應
    expect(res?.status()).not.toBe(200)
  })
})
