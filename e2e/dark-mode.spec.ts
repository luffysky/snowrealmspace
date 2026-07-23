import { test, expect, signInThroughUi } from './fixtures'

/**
 * 深／淺色切換（選項 A：任何主題都能切暗色版）。
 */

function bgVar(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--sr-background').trim(),
  )
}

test.describe('深淺色切換', () => {
  test('切到深色會變暗，重整後仍是深色', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const lightBg = await bgVar(page)
    expect(lightBg).toBeTruthy()

    // 切到深色
    await page.getByRole('button', { name: '切換到深色模式' }).click()
    const darkBg = await bgVar(page)
    expect(darkBg).not.toBe(lightBg)

    // 按鈕狀態翻轉、aria 正確
    await expect(page.getByRole('button', { name: '切換到淺色模式' })).toBeVisible()

    // 重整：cookie 讓 SSR 首屏就是深色
    await page.reload()
    await expect(page.getByRole('button', { name: '切換到淺色模式' })).toBeVisible()
    expect(await bgVar(page)).toBe(darkBg)

    // 切回淺色
    await page.getByRole('button', { name: '切換到淺色模式' }).click()
    await expect(page.getByRole('button', { name: '切換到深色模式' })).toBeVisible()
    expect(await bgVar(page)).toBe(lightBg)
  })
})
