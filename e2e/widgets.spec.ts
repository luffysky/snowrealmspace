import AxeBuilder from '@axe-core/playwright'
import { test, expect, signInThroughUi } from './fixtures'

/**
 * Widget 拖曳與鍵盤操作。
 * v1.0 §55：「可拖曳 Widget」「所有設定會保存」。
 * 06-widget-contract.md §8：鍵盤必須能完成全部拖曳操作。
 */

/**
 * 格線只存在於桌機與平板。
 * 06-widget-contract.md §1：**行動版不使用格線**，是單欄垂直排序 ——
 * 在 375px 寬度上拖曳 12 欄格線本質上不可用。
 * 所以這一組測試在 mobile 專案要跳過，行動版有自己的一組。
 */
test.describe('Home 版面（格線，桌機／平板）', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), '行動版不使用格線')

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

    await page.getByRole('button', { name: /移除 隨手記/ }).first().click()
    await expect(page.locator('.sr-widget-slot')).toHaveCount(initial)
  })

  test('可以新增版面、切換，兩套版面各自獨立', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    const initialSlots = await page.locator('.sr-widget-slot').count()
    expect(initialSlots).toBeGreaterThan(0)

    // 新增版面會用 prompt 問名稱 —— 先掛好對話框處理
    page.once('dialog', (dialog) => void dialog.accept('第二版面'))
    await page.getByRole('button', { name: '新增版面' }).click()

    // 切到新版面後（router.refresh 重載），會出現版面切換器
    await expect(page.getByLabel('選擇版面')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel('選擇版面')).toHaveValue(/.+/)

    // 新版面是全新的，也會帶入預設區塊（不是空白）
    await expect(page.locator('.sr-widget-slot').first()).toBeVisible()

    // 切回第一個版面
    const options = await page.getByLabel('選擇版面').locator('option').all()
    expect(options.length).toBe(2)
    const firstValue = await options[0]!.getAttribute('value')
    await page.getByLabel('選擇版面').selectOption(firstValue!)

    // 切換後仍看得到區塊（版面內容隨切換重載）
    await expect(page.locator('.sr-widget-slot').first()).toBeVisible({ timeout: 15_000 })
  })

  test('不能刪除最後一個版面', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    // 只有一個版面時，刪除按鈕不該出現（切換器也不出現）
    await expect(page.getByRole('button', { name: '刪除此版面' })).toHaveCount(0)
    await expect(page.getByLabel('選擇版面')).toHaveCount(0)
  })

  test('可以調整區塊設定，重新載入後保留', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    // 打開第一個區塊的設定
    await page.getByRole('button', { name: '設定', exact: true }).first().click()

    // 設定面板是從 schema 自動生成的 —— 一定至少有一個控制項
    const panel = page.locator('.sr-widget-settings').first()
    await expect(panel).toBeVisible()

    // 切換第一個 checkbox 設定並儲存
    const firstToggle = panel.getByRole('checkbox').nth(2) // 前兩個是隱藏/鎖定
    const wasChecked = await firstToggle.isChecked()
    await firstToggle.setChecked(!wasChecked)
    await page.getByRole('button', { name: '儲存設定' }).click()

    await page.reload()
    await page.getByRole('button', { name: '編輯版面' }).click()
    await page.getByRole('button', { name: '設定', exact: true }).first().click()
    const reloaded = page.locator('.sr-widget-settings').first().getByRole('checkbox').nth(2)
    await expect(reloaded).toBeChecked({ checked: !wasChecked })
  })

  test('隱藏區塊會從格線移除，但仍能從設定重新開啟', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const initial = await page.locator('.sr-widget-slot').count()
    expect(initial).toBeGreaterThan(0)

    await page.getByRole('button', { name: '編輯版面' }).click()
    await page.getByRole('button', { name: '設定', exact: true }).first().click()

    // 隱藏 → 格線少一個，但設定清單仍列出（否則沒有入口再打開）
    await page.getByRole('checkbox', { name: /隱藏這個區塊/ }).check()
    await expect(page.locator('.sr-widget-slot')).toHaveCount(initial - 1)
    await expect(page.getByText('（已隱藏）')).toBeVisible()

    // 取消隱藏 → 回到格線
    await page.getByRole('checkbox', { name: /隱藏這個區塊/ }).uncheck()
    await expect(page.locator('.sr-widget-slot')).toHaveCount(initial)
  })

  test('鎖定的區塊在設定清單標示，且不再顯示移動把手', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    const handlesBefore = await page.locator('.sr-widget-handle').count()

    await page.getByRole('button', { name: '設定', exact: true }).first().click()
    await page.getByRole('checkbox', { name: /鎖定位置/ }).check()

    await expect(page.getByText('（已鎖定）')).toBeVisible()
    // 鎖定的 widget 不該有可拖動的把手
    await expect(page.locator('.sr-widget-handle')).toHaveCount(handlesBefore - 1)
  })

  test('未實作的區塊不可加入', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    // Q6：不做假按鈕 —— 沒實作的一定是停用狀態
    await expect(page.getByRole('button', { name: '每日卡片' })).toBeDisabled()
  })

  test('縮到手機寬度時改用單欄，不出現格線', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.setViewportSize({ width: 390, height: 800 })
    await page.reload()

    await expect(page.locator('.sr-mobile-stack')).toBeVisible()
    await expect(page.locator('.sr-widget-grid')).toHaveCount(0)
    await expect(page.getByText(/目前是手機版面/)).toBeVisible()
  })
})

test.describe('Home 版面（行動版單欄）', () => {
  test.skip(({ isMobile }) => !isMobile, '這一組只驗行動版')

  test('用單欄堆疊而非格線', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    await expect(page.locator('.sr-mobile-stack')).toBeVisible()
    await expect(page.locator('.sr-widget-grid')).toHaveCount(0)
    await expect(page.getByText(/目前是手機版面/)).toBeVisible()
  })

  test('預設區塊仍然看得到', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    await expect(page.getByRole('heading', { name: '主題' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '背景' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '隨手記' })).toBeVisible()
  })

  test('不顯示拖曳把手（行動版不支援拖曳）', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '編輯版面' }).click()

    await expect(page.locator('.sr-widget-handle')).toHaveCount(0)
    await expect(page.locator('.sr-widget-resize')).toHaveCount(0)
  })

  test('版面不會產生水平溢位', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    // 溢位會讓行動瀏覽器縮小整頁，所有點擊座標偏移
    const sizes = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
    }))
    expect(sizes.doc).toBeLessThanOrEqual(sizes.view)
  })
})

test.describe('Widget 無障礙 @a11y', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), '編輯把手只存在於格線版面')

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
