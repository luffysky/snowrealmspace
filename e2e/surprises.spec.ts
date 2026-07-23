import { test, expect, signInThroughUi } from './fixtures'

/**
 * 驚喜收藏牆 + 機率公開 + 收藏。
 */

test.describe('驚喜收藏', () => {
  test('開盒後在收藏頁看得到、可收藏、機率公開', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    // Home 打開今天的盒子
    await page.getByRole('button', { name: '打開', exact: true }).click()
    await expect(page.locator('.sr-surprise-opened')).toBeVisible({ timeout: 15_000 })

    // 進收藏頁
    await page.getByRole('link', { name: '看收藏 →' }).click()
    await expect(page).toHaveURL(/\/surprises/)
    await expect(page.getByRole('heading', { name: '驚喜收藏' })).toBeVisible()

    // 機率公開（誠實：數字要在頁面上）
    await expect(page.getByRole('heading', { name: '掉落機率' })).toBeVisible()
    await expect(page.getByText('保底：')).toBeVisible()

    // 至少一張卡片
    const card = page.locator('.sr-archive-card').first()
    await expect(card).toBeVisible()

    // 收藏 → 重整後仍收藏
    const star = card.getByRole('button', { name: '收藏', exact: true })
    await star.click()
    const unfav = card.getByRole('button', { name: '取消收藏' })
    await expect(unfav).toBeVisible()
    // 等 server action 落地（收藏中按鈕會 disabled，寫完才 enabled）再重整
    await expect(unfav).toBeEnabled()

    await page.reload()
    await expect(
      page.locator('.sr-archive-card').first().getByRole('button', { name: '取消收藏' }),
    ).toBeVisible()

    // 只看收藏能篩選
    await page.getByRole('button', { name: '只看收藏' }).click()
    await expect(page.locator('.sr-archive-card')).toHaveCount(1)
  })
})
