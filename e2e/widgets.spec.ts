import AxeBuilder from '@axe-core/playwright'
import { test, expect, signInThroughUi } from './fixtures'

/**
 * Widget 拖曳與鍵盤操作。
 * v1.0 §55：「可拖曳 Widget」「所有設定會保存」。
 * 06-widget-contract.md §8：鍵盤必須能完成全部拖曳操作。
 */

test.describe('Home 版面', () => {
  test('第一次進來就有預設區塊', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    await expect(page.locator('.sr-widget-slot')).not.toHaveCount(0)
    await expect(page.getByRole('heading', { name: '主題' })).toBeVisible()
  })

  test('編輯模式才顯示把手', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    await expect(page.locator('.sr-widget-handle')).toHaveCount(0)

    await page.getByRole('button', { name: '編輯版面' }).click()
    await expect(page.locator('.sr-widget-handle').first()).toBeVisible()

    await page.getByRole('button', { name: '完成編輯' }).click()
    await expect(page.locator('.sr-widget-handle')).toHaveCount(0)
  })

  /**
   * 06-widget-contract.md §8：這是 WCAG 2.2 的硬需求。
   * 只能用滑鼠拖曳的版面編輯器是不可用的。
   */
  test('可用鍵盤移動區塊，且位置會保存', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    /*
     * 追蹤特定的 widget，不能用 .nth(0) ——
     * DOM 順序會依位置重新排序，nth(0) 永遠是左上角那個，
     * 讀到的位置恆定不變，測不出任何東西。
     */
    const themeSlot = page.locator('.sr-widget-slot').filter({ hasText: '主題' })
    // 聚焦的必須是這個 widget 自己的把手
    await themeSlot.locator('.sr-widget-handle').focus()

    const areaOf = () =>
      themeSlot.evaluate((el) => {
        const s = getComputedStyle(el)
        return `${s.gridColumnStart}/${s.gridRowStart}`
      })

    const before = await areaOf()

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(800)

    const after = await areaOf()
    expect(after, '按方向鍵後位置應該改變').not.toBe(before)

    // 重新載入後仍在新位置（v1.0 §55：所有設定會保存）
    await page.reload()
    expect(await areaOf()).toBe(after)
  })

  test('Shift 加方向鍵可調整大小', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    const handle = page.locator('.sr-widget-handle').first()
    await handle.focus()

    const slot = page.locator('.sr-widget-slot').first()
    const before = await slot.evaluate((el) => getComputedStyle(el).gridColumnEnd)

    await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(600)

    const after = await slot.evaluate((el) => getComputedStyle(el).gridColumnEnd)
    expect(after).not.toBe(before)
  })

  test('移動時會播報新位置給螢幕閱讀器', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    await page.locator('.sr-widget-handle').first().focus()
    await page.keyboard.press('ArrowRight')

    const live = page.locator('[aria-live="polite"]').first()
    await expect(live).toContainText(/第 \d+ 欄第 \d+ 列/)
  })

  test('Esc 取消並回到原位', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    const slot = page.locator('.sr-widget-slot').first()
    const original = await slot.evaluate((el) => getComputedStyle(el).gridColumnStart)

    await page.locator('.sr-widget-handle').first().focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape')

    await expect
      .poll(() => slot.evaluate((el) => getComputedStyle(el).gridColumnStart))
      .toBe(original)
  })

  test('新增與移除區塊', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const initial = await page.locator('.sr-widget-slot').count()

    await page.getByRole('button', { name: '編輯版面' }).click()
    await page.getByRole('button', { name: '隨手記', exact: true }).click()

    await expect(page.locator('.sr-widget-slot')).toHaveCount(initial + 1)

    await page.getByRole('button', { name: /移除「隨手記」/ }).first().click()
    await expect(page.locator('.sr-widget-slot')).toHaveCount(initial)
  })

  test('未實作的區塊不可加入', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    // Q6：不做假按鈕 —— 沒實作的一定是停用狀態
    await expect(page.getByRole('button', { name: '每日卡片' })).toBeDisabled()
  })

  test('行動裝置改用單欄，不出現格線', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.setViewportSize({ width: 390, height: 800 })
    await page.reload()

    await expect(page.locator('.sr-mobile-stack')).toBeVisible()
    await expect(page.locator('.sr-widget-grid')).toHaveCount(0)
    await expect(page.getByText(/目前是手機版面/)).toBeVisible()
  })
})

test.describe('Widget 無障礙 @a11y', () => {
  test('編輯模式沒有嚴重的無障礙問題', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()
    await expect(page.locator('.sr-widget-handle').first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(
      blocking,
      blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n'),
    ).toEqual([])
  })

  test('把手可用 Tab 到達', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    const handle = page.locator('.sr-widget-handle').first()
    await expect(handle).toHaveAttribute('tabindex', '0')
    await expect(handle).toHaveAttribute('aria-roledescription', '可移動的區塊')
  })
})
