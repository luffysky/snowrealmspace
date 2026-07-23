import { test, expect, signInThroughUi } from './fixtures'
import { makeTestPng } from './helpers/image'

/**
 * Milestone B 閉環的前半：
 * 「使用者能上傳背景圖、建立幻燈片…關掉瀏覽器再打開，空間仍是他布置的樣子。」
 */

async function uploadImage(page: import('@playwright/test').Page, name: string, seed = 0) {
  await page.goto('/library')
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: 'image/png',
    // 不同 seed 才會是不同檔案 —— 相同位元組會被去重
    buffer: await makeTestPng({ seed }),
  })
  await expect(page.getByText('✓ 完成。')).toBeVisible({ timeout: 30_000 })
}

test.describe('Background Studio', () => {
  test('沒有圖片時明確說明下一步', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')

    await expect(page.getByText(/先到 Library 上傳一張/)).toBeVisible()
  })

  test('把上傳的圖片變成背景', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await uploadImage(page, 'bg-source.png')

    await page.goto('/studio/background')
    await page.getByLabel('從你的圖片選一張').selectOption({ label: 'bg-source.png' })

    await expect(page.getByRole('main').getByRole('status')).toContainText('已加入背景')
    await expect(page.getByRole('heading', { name: /你的背景（1）/ })).toBeVisible()
    // 加入後直接進編輯，使用者不必再點一次
    await expect(page.getByRole('heading', { name: '調整這個背景' })).toBeVisible()
  })

  test('加入漸層背景不需要任何圖片', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')

    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已加入漸層背景')
    await expect(page.getByRole('heading', { name: /你的背景（1）/ })).toBeVisible()
  })

  test('調整設定後重新載入仍保留', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')
    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('heading', { name: '調整這個背景' })).toBeVisible()

    const blur = page.getByLabel(/模糊/)
    await blur.fill('20')

    // debounce 400ms 後才送出
    await page.waitForTimeout(1200)
    await page.reload()

    await page.getByRole('button', { name: /編輯 漸層/ }).click()
    await expect(page.getByLabel(/模糊/)).toHaveValue('20')
  })

  test('建立幻燈片、加入背景、啟用後在 Home 生效', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')

    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已加入漸層背景')

    await page.getByLabel('新播放清單的名稱').fill('測試幻燈片')
    await page.getByRole('button', { name: '建立播放清單' }).click()
    await expect(page.getByText('測試幻燈片')).toBeVisible()

    // 空清單不能啟用 —— 那會產生一個看不到任何東西的「播放中」狀態
    await expect(page.getByRole('button', { name: '啟用' })).toBeDisabled()

    await page.getByLabel('加入背景').selectOption({ label: '漸層' })
    await expect(page.getByRole('button', { name: '啟用' })).toBeEnabled()

    await page.getByRole('button', { name: '啟用' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已啟用')

    // 背景真的出現在 Home
    await page.goto('/home')
    await expect(page.locator('.sr-bg-layer')).toBeAttached()
  })

  test('清單項目可用鍵盤上下移動', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await uploadImage(page, 'first.png', 1)
    await uploadImage(page, 'second.png', 2)

    await page.goto('/studio/background')
    await page.getByLabel('從你的圖片選一張').selectOption({ label: 'first.png' })
    await expect(page.getByRole('main').getByRole('status')).toContainText('已加入背景')
    await page.getByLabel('從你的圖片選一張').selectOption({ label: 'second.png' })

    await page.getByLabel('新播放清單的名稱').fill('排序測試')
    await page.getByRole('button', { name: '建立播放清單' }).click()

    // 背景以來源檔名命名，才分辨得出是哪一個
    await page.getByLabel('加入背景').selectOption({ label: 'first' })
    await expect(page.locator('.sr-playlist-item')).toHaveCount(1)
    await page.getByLabel('加入背景').selectOption({ label: 'second' })
    await expect(page.locator('.sr-playlist-item')).toHaveCount(2)

    // 順序正確
    await expect(page.locator('.sr-playlist-item').first()).toContainText('first')

    // 第一項不能再往前
    await expect(page.getByRole('button', { name: '把第 1 項往前移' })).toBeDisabled()

    await page.getByRole('button', { name: '把第 1 項往後移' }).click()
    // 移動後第一項變成 second
    await expect(page.locator('.sr-playlist-item').first()).toContainText('second')
  })

  test('移除背景後清單也跟著更新', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')

    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('heading', { name: /你的背景（1）/ })).toBeVisible()

    await page.getByRole('button', { name: /移除 漸層/ }).click()
    await expect(page.getByRole('heading', { name: /你的背景（0）/ })).toBeVisible()
  })
})

test.describe('背景無障礙 @a11y', () => {
  test('Background Studio 沒有嚴重的無障礙問題', async ({ page, invited }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')
    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('heading', { name: '調整這個背景' })).toBeVisible()

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

  test('時段排程：設定 UI 出現、重疊被擋、儲存後保留', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/background')

    // 兩張漸層背景，才有東西可以分配到不同時段
    await page.getByRole('button', { name: '加入漸層背景' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已加入漸層背景')
    await page.getByRole('button', { name: '加入漸層背景' }).click()

    await page.getByLabel('新播放清單的名稱').fill('時段測試')
    await page.getByRole('button', { name: '建立播放清單' }).click()
    await page.getByLabel('加入背景').selectOption({ index: 1 })

    // 切到「依時段」→ 排程編輯器要出現（先前完全沒有這個介面）
    await page.getByLabel('播放方式').selectOption('time_of_day')
    await page.getByRole('button', { name: '新增時段' }).click()
    await expect(page.locator('.sr-schedule-slot')).toHaveCount(1)

    // 第一個時段設成 0–12（此時沒有其他時段，會被存下）
    const slots = page.locator('.sr-schedule-slot')
    await slots.nth(0).getByLabel('從').selectOption('0')
    await slots.nth(0).getByLabel('到').selectOption('12')

    // 加第二個時段，最後一步故意做成與第一個重疊 → 必須即時擋下並說明。
    // （重疊的變更會被拒絕不儲存，所以錯誤訊息一定是最後這個動作留下的）
    await page.getByRole('button', { name: '新增時段' }).click()
    await slots.nth(1).getByLabel('從').selectOption('6')
    // role=alert 會同時匹配 Next 的路由播報器，要指定錯誤訊息本身
    await expect(page.locator('.sr-message-error')).toContainText('同時屬於兩個時段')

    // 重新整理後仍是「依時段」，且存下來的是**不重疊**的那個狀態
    // （新增時段時的有效值有存，最後那個重疊的改動被拒絕沒存）
    await page.reload()
    await expect(page.getByLabel('播放方式')).toHaveValue('time_of_day')
    await expect(page.locator('.sr-schedule-slot')).toHaveCount(2)
    await expect(page.locator('.sr-message-error')).toHaveCount(0)
  })
})
