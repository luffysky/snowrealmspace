import { test, expect, signInThroughUi } from './fixtures'
import { makeTestPng } from './helpers/image'

/**
 * Milestone B：上傳 + Theme Studio。
 * v1.0 §45.2 的關鍵流程：Theme Creation / Theme Apply / Background Upload / Theme From Image。
 */

test.describe('Theme Studio', () => {
  test('可自訂顏色並儲存，重新載入後保留', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('link', { name: 'Theme' }).click()
    await expect(page.getByRole('heading', { name: 'Theme Studio' })).toBeVisible()

    await page.getByLabel('主題名稱').fill('我的第一套')
    await page.getByLabel('主色的色碼').fill('#3a7bd5')

    await page.getByRole('button', { name: '建立' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已另存為新主題')

    await page.reload()
    // 主題庫裡看得到剛存的
    await expect(page.getByRole('button', { name: /我的第一套/ })).toBeVisible()
  })

  test('即時預覽會跟著調整改變', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    const preview = page.locator('.sr-preview-surface')
    const before = await preview.evaluate(
      (el) => getComputedStyle(el).getPropertyValue('--sr-background').trim(),
    )

    await page.getByLabel('背景的色碼').fill('#102030')

    await expect
      .poll(async () =>
        preview.evaluate((el) => getComputedStyle(el).getPropertyValue('--sr-background').trim()),
      )
      .toBe('#102030')

    expect(before).not.toBe('#102030')
  })

  /** ADR-011：不合格不阻止儲存，但要說清楚怎麼改。 */
  test('對比不足時顯示具體修改建議而非只有錯誤', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    // 淺字配淺底
    await page.getByLabel('背景的色碼').fill('#ffffff')
    await page.getByLabel('主要文字的色碼').fill('#f2f2f2')

    const panel = page.locator('.sr-message-error').filter({ hasText: '對比不足' })
    await expect(panel).toBeVisible()
    // 必須有具體數字與方向，不能只是紅叉
    await expect(panel).toContainText(':1')
    await expect(panel).toContainText(/調暗|調亮/)
  })

  test('不合格的主題仍可儲存', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByLabel('背景的色碼').fill('#ffffff')
    await page.getByLabel('主要文字的色碼').fill('#f2f2f2')
    await page.getByLabel('主題名稱').fill('低對比主題')
    await page.getByRole('button', { name: '建立' }).click()

    await expect(page.getByRole('main').getByRole('status')).toContainText('已另存為新主題')
  })

  test('切換卡片材質會改變預覽', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByRole('radio', { name: /實色/ }).check()
    await expect(page.locator('.sr-preview-surface')).toHaveAttribute(
      'data-surface-style',
      'solid',
    )

    await page.getByRole('radio', { name: /線框/ }).check()
    await expect(page.locator('.sr-preview-surface')).toHaveAttribute(
      'data-surface-style',
      'outline',
    )
  })

  test('套用主題後整個空間都改變', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByLabel('主題名稱').fill('要套用的主題')
    await page.getByLabel('背景的色碼').fill('#101820')
    await page.getByLabel('主要文字的色碼').fill('#f0f4f8')
    await page.getByRole('button', { name: '建立' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已另存為新主題')

    await page.getByRole('button', { name: '套用', exact: true }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已套用')

    // 換頁後仍是套用的主題 —— 「設定會保存」（v1.0 §55）
    await page.goto('/home')
    const applied = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sr-background').trim(),
    )
    expect(applied).toBe('#101820')
  })

  test('未儲存的變更不能套用', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByLabel('主題名稱').fill('草稿')
    await page.getByRole('button', { name: '建立' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已另存為新主題')

    await page.getByLabel('主色的色碼').fill('#ff0000')
    await expect(page.getByRole('button', { name: '套用', exact: true })).toBeDisabled()
  })

  test('內建主題載入後另存為新的，不覆寫原本的', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByRole('button', { name: /夜/ }).first().click()
    await expect(page.getByLabel('主題名稱')).toHaveValue('夜')

    // 內建主題不可覆寫，按鈕應該是「建立」而非「儲存」
    await expect(page.getByRole('button', { name: '建立' })).toBeVisible()
  })

  test('還原預設會回到內建主題', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await page.getByLabel('主色的色碼').fill('#123456')
    await page.getByRole('button', { name: '還原預設' }).click()

    await expect(page.getByLabel('主色的色碼')).not.toHaveValue('#123456')
  })
})

test.describe('上傳與從圖片生成主題', () => {
  test('上傳圖片後出現在檔案清單', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/library')

    await page.setInputFiles('input[type="file"]', {
      name: 'test-upload.png',
      mimeType: 'image/png',
      buffer: await makeTestPng(),
    })

    await expect(page.getByText('✓ 完成。')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /test-upload\.png，可用來生成主題/ })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('不支援的檔案類型在前端就被擋下', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/library')

    await page.setInputFiles('input[type="file"]', {
      name: 'evil.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
    })

    await expect(page.getByText(/不支援/)).toBeVisible({ timeout: 15_000 })
  })

  test('從上傳的圖片生成主題並儲存', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/library')

    await page.setInputFiles('input[type="file"]', {
      name: 'palette-source.png',
      mimeType: 'image/png',
      buffer: await makeTestPng(),
    })
    await expect(page.getByText('✓ 完成。')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /palette-source\.png，可用來生成主題/ }).click()

    await expect(page.getByRole('heading', { name: /生成主題/ })).toBeVisible()
    // 三個變體，且每個都標示對比結果
    await expect(page.getByRole('button', { name: '存成主題' })).toHaveCount(3, {
      timeout: 30_000,
    })
    await expect(page.getByText(/對比達標/).first()).toBeVisible()

    await page.getByRole('button', { name: '存成主題' }).first().click()

    await page.goto('/studio/theme')
    await expect(page.getByText(/明亮|柔和|深色/).first()).toBeVisible()
  })

  test('刪除被主題引用的圖片會先詢問', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/library')

    await page.setInputFiles('input[type="file"]', {
      name: 'referenced.png',
      mimeType: 'image/png',
      buffer: await makeTestPng(),
    })
    await expect(page.getByText('✓ 完成。')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /referenced\.png，可用來生成主題/ }).click()
    await expect(page.getByRole('button', { name: '存成主題' }).first()).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: '存成主題' }).first().click()

    // 確認對話框會列出引用
    let dialogMessage = ''
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.dismiss()
    })

    await page.getByRole('button', { name: /刪除 referenced\.png/ }).click()

    await expect.poll(() => dialogMessage).toContain('使用中')
  })
})
