import { test, expect } from './fixtures'

/**
 * 帳號密碼註冊 / 登入（不寄信）。
 *
 * 站台密碼閘門把關「誰能進站」，所以進站後的註冊不需要邀請。
 * 密碼登入不寄信 —— SMTP 還沒好時仍能進站。
 */

function uniqueEmail() {
  return `pw-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.local`
}

test.describe('帳號密碼註冊 / 登入', () => {
  test('註冊 → 進站 → 引導綁定頁', async ({ page }) => {
    const email = uniqueEmail()
    await page.goto('/login')

    await page.getByRole('button', { name: '註冊', exact: true }).click()
    await page.locator('#pw-account').fill(email)
    await page.locator('input[name="password"]').fill('supersecret123')
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click()

    // 註冊後導去綁定頁，出現引導
    await expect(page).toHaveURL(/\/settings\/account\?welcome=1/, { timeout: 20_000 })
    await expect(page.getByText('綁定其他登入方式')).toBeVisible()
    await expect(page.getByText(email).first()).toBeVisible()
  })

  test('註冊後登出，用密碼再登入看到同一個空間', async ({ page }) => {
    const email = uniqueEmail()
    await page.goto('/login')
    await page.getByRole('button', { name: '註冊', exact: true }).click()
    await page.locator('#pw-account').fill(email)
    await page.locator('input[name="password"]').fill('supersecret123')
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click()
    await expect(page).toHaveURL(/welcome=1/, { timeout: 20_000 })

    await page.goto('/settings')
    await page.getByRole('button', { name: '登出' }).click()
    await expect(page).toHaveURL(/\/login/)

    // 密碼登入（預設就是登入模式）
    await page.locator('#pw-account').fill(email)
    await page.locator('input[name="password"]').fill('supersecret123')
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click()

    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 })
    await expect(page.locator('.sr-daily-card')).toBeVisible()
  })

  test('重複 email 註冊會被擋', async ({ page }) => {
    const email = uniqueEmail()
    // 第一次註冊
    await page.goto('/login')
    await page.getByRole('button', { name: '註冊', exact: true }).click()
    await page.locator('#pw-account').fill(email)
    await page.locator('input[name="password"]').fill('supersecret123')
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click()
    await expect(page).toHaveURL(/welcome=1/, { timeout: 20_000 })

    // 登出後再用同 email 註冊
    await page.goto('/settings')
    await page.getByRole('button', { name: '登出' }).click()
    await page.goto('/login')
    await page.getByRole('button', { name: '註冊', exact: true }).click()
    await page.locator('#pw-account').fill(email)
    await page.locator('input[name="password"]').fill('anotherpassword')
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click()

    await expect(page.locator('.sr-message-error')).toContainText('已經註冊過')
  })

  test('密碼太短擋在前端', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '註冊', exact: true }).click()
    await expect(page.locator('input[name="password"]')).toHaveAttribute('minlength', '8')
  })

  test('眼睛可切換顯示 / 隱藏密碼', async ({ page }) => {
    await page.goto('/login')
    const pw = page.locator('input[name="password"]')
    await pw.fill('supersecret123')
    await expect(pw).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: '顯示密碼' }).click()
    await expect(pw).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: '隱藏密碼' }).click()
    await expect(pw).toHaveAttribute('type', 'password')
  })

  test('註冊時顯示密碼強度', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '註冊', exact: true }).click()

    const pw = page.locator('input[name="password"]')
    await pw.fill('abc')
    await expect(page.getByText('強度：')).toBeVisible()

    // 弱 → 強會改變標籤
    await pw.fill('Str0ng!Passphrase#2026')
    await expect(page.getByText(/強度：(強|很強)/)).toBeVisible()
  })

  test('忘記密碼連結通往重設頁', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: '忘記密碼？' }).click()
    await expect(page).toHaveURL(/\/forgot/)
    await expect(page.getByRole('heading', { name: '忘記密碼' })).toBeVisible()

    // 送出後一律回相同訊息（避免帳號枚舉），不透露帳號是否存在
    await page.getByLabel('帳號的 email').fill('someone@example.com')
    await page.getByRole('button', { name: '寄送重設連結' }).click()
    await expect(page.getByRole('status')).toContainText('如果這個帳號')
  })
})
