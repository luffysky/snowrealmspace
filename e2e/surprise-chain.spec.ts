import { test, expect } from './fixtures'
import { signInThroughUi } from './fixtures'

/**
 * 驚喜盒 + 生日鏈（Milestone E）。
 *
 * 需要 content_items 已 seed（surprise / chain）。pnpm db:seed 會一併灌。
 */

test.describe('驚喜盒', () => {
  test('Home 預設有驚喜盒，可打開並顯示內容', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const box = page.locator('.sr-surprise')
    await expect(box).toBeVisible({ timeout: 15_000 })

    // 沒 seed 時顯示「今天沒有驚喜」→ 跳過（本機需 db:seed）
    const emptyText = await page.locator('.sr-surprise').innerText()
    test.skip(emptyText.includes('今天沒有驚喜'), 'surprise 未 seed')

    await page.getByRole('button', { name: '打開' }).click()

    // 開盒後顯示稀有度徽章與內容
    await expect(page.locator('.sr-surprise-rarity')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.sr-surprise-text')).not.toBeEmpty()
  })

  test('開過的驚喜同一天穩定（重整不變）', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const box = page.locator('.sr-surprise')
    await expect(box).toBeVisible({ timeout: 15_000 })
    const emptyText = await box.innerText()
    test.skip(emptyText.includes('今天沒有驚喜'), 'surprise 未 seed')

    await page.getByRole('button', { name: '打開' }).click()
    await expect(page.locator('.sr-surprise-text')).toBeVisible({ timeout: 10_000 })
    const first = await page.locator('.sr-surprise-text').innerText()

    await page.reload()
    await expect(page.locator('.sr-surprise-text')).toBeVisible({ timeout: 10_000 })
    expect(await page.locator('.sr-surprise-text').innerText()).toBe(first)
  })
})

test.describe('生日鏈', () => {
  test('Home 有生日鏈，第一環（生日快樂）預設解鎖並可讀', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const chain = page.locator('.sr-chain')
    await expect(chain).toBeVisible({ timeout: 15_000 })

    const emptyText = await chain.innerText()
    test.skip(emptyText.includes('還沒有生日鏈'), 'chain 未 seed')

    // 第一環（chainIndex 0）預設解鎖 → 點開有內容
    const firstNode = page.locator('.sr-chain-node').first()
    await expect(firstNode).toHaveAttribute('data-unlocked', 'true')
    await expect(page.locator('.sr-chain-text').first()).toBeVisible()
  })

  test('未解鎖的環顯示條件提示而非內容', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const chain = page.locator('.sr-chain')
    await expect(chain).toBeVisible({ timeout: 15_000 })
    test.skip((await chain.innerText()).includes('還沒有生日鏈'), 'chain 未 seed')

    // 一年後那一環：新 space 一定沒解鎖 → 顯示提示、不顯示內容
    const locked = page.locator('.sr-chain-node[data-unlocked="false"]')
    if ((await locked.count()) > 0) {
      await expect(locked.first().locator('.sr-chain-hint')).toBeVisible()
      await expect(locked.first().getByText('還沒解鎖')).toBeVisible()
    }
  })
})
