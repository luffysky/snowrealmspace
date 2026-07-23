import { test, expect, signInThroughUi, clearMailbox, cleanupUser } from './fixtures'

/**
 * v1.0 §45.2 的第一條關鍵流程：Onboarding。
 * Milestone A 的閉環：受邀者能登入、看到自己的空 Space、登出再登入資料仍在。
 */

test.describe('邀請與登入', () => {
  test('受邀者可完成登入並看到自己的 Space', async ({ page, invited }) => {
    await page.goto(invited.inviteUrl)

    // 邀請頁應該明確顯示這封邀請是給誰的
    await expect(page.getByRole('heading', { name: '這裡是為你準備的' })).toBeVisible()
    await expect(page.getByText(invited.email)).toBeVisible()

    await signInThroughUi(page, invited)

    // 進到自己的 Space
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('的空間')
    // Home 是 widget 版面（Milestone B）。桌機用格線、行動版用單欄，
    // 所以斷言在「內容有出現」這一層，而不是特定的容器 class。
    await expect(page.getByRole('heading', { name: '主題' })).toBeVisible()
  })

  test('未受邀的 email 無法取得空間', async ({ page }) => {
    await page.goto('/login')
    // magic link 表單收在「用 Email 登入連結」摺疊區裡（主流程改帳號密碼）
    await page.getByText('用 Email 登入連結').click()
    await page.getByLabel('Email').fill(`stranger-${Date.now()}@e2e.local`)
    await page.getByRole('button', { name: '寄送登入連結' }).click()

    // 訊息必須說明是邀請制，而不是含糊的「失敗」
    await expect(page.getByRole('main').getByRole('alert')).toContainText('邀請制')
  })

  test('無效的邀請 token 顯示明確原因', async ({ page }) => {
    await page.goto('/invite?token=totally-invalid-token')
    await expect(page.getByRole('heading', { name: '邀請無法使用' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('無效')
  })

  test('未登入者存取 /home 會被導向登入頁', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login/)
  })

  test('登出後資料仍在，重新登入看得到同一個 Space', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const spaceName = await page.getByRole('heading', { level: 1 }).textContent()
    expect(spaceName).toBeTruthy()

    await page.getByRole('button', { name: '登出' }).click()
    await page.waitForURL('**/login', { timeout: 20_000 })

    // 登出後真的進不去
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login/)

    // 第二次登入不需要邀請連結
    await clearMailbox()
    await page.goto('/login')
    await page.getByText('用 Email 登入連結').click()
    await page.getByLabel('Email').fill(invited.email)
    await page.getByRole('button', { name: '寄送登入連結' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('登入連結已寄到', {
      timeout: 45_000,
    })

    const { fetchMagicLink } = await import('./fixtures')
    const link = await fetchMagicLink(invited.email, 30_000)
    await page.goto(link)
    await page.waitForURL('**/home', { timeout: 30_000 })

    // 同一個 Space，不是新建的
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(spaceName!)
  })

  test('邀請不可重複使用', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('button', { name: '登出' }).click()
    await page.waitForURL('**/login')

    await page.goto(invited.inviteUrl)
    await expect(page.getByRole('heading', { name: '邀請無法使用' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('使用過')
  })
})

test.describe('隱私設定', () => {
  test('預設全部關閉，且可儲存後保留', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings$/)

    // ADR-014：隱私相關預設關閉
    await expect(page.getByLabel('允許 Agent 記住事情')).not.toBeChecked()
    await expect(page.getByLabel('允許 AI 分析我的作品')).not.toBeChecked()
    await expect(page.getByLabel('允許連接外部設計軟體')).not.toBeChecked()
    // 活動追蹤預設開啟（產品運作必需，但可關）
    await expect(page.getByLabel('記錄我的活動')).toBeChecked()

    await page.getByLabel('允許 Agent 記住事情').check()
    await page.getByRole('button', { name: '儲存' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('已儲存')

    // 重新載入後仍保留 —— 「設定會保存」是 v1.0 §55 的明列條件
    await page.reload()
    await expect(page.getByLabel('允許 Agent 記住事情')).toBeChecked()
  })

  test('每個開關都有說明它關掉會發生什麼', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings')

    // v1.0 §5.1：使用者必須能理解自己在控制什麼
    await expect(page.getByText('關閉時 Agent 不會提議記住任何事')).toBeVisible()
    await expect(page.getByText('關閉時仍可看到系統本地計算的數據')).toBeVisible()
  })
})

test.describe('Feature flag（ADR-018）', () => {
  test('未啟用的功能路由回 404 而非空白頁', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    // 這些路由在 Milestone A 尚未實作，必須是真正的 404
    const res = await page.goto('/design')
    expect(res?.status()).toBe(404)
  })
})

test.afterAll(async () => {
  await clearMailbox()
})

export { cleanupUser }
