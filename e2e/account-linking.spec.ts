import { test, expect } from './fixtures'
import { signInThroughUi } from './fixtures'

/**
 * 綁定 Google / LINE。13-third-party-auth.md §5。
 *
 * 沒有 provider 憑證時測不到真正的 OAuth 往返 —— 那需要外部帳號。
 * 這裡測的是**沒有憑證也必須成立**的部分，而那正是最容易寫錯的地方：
 *   - 用 magic link 註冊的人一開始就有一筆 email 身分
 *   - 唯一的登入方式不可解除（否則使用者把自己鎖在門外）
 *   - 未設定的 provider 顯示為停用並說明原因，而不是假裝可用
 */
test.describe('登入方式綁定', () => {
  test('註冊後就有一種登入方式，且列在設定頁', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings/account')

    await expect(page.getByRole('heading', { name: '登入方式' })).toBeVisible()
    await expect(page.getByText('Email 登入連結')).toBeVisible()
    // email 同時出現在頁首與清單列，取第一個即可
    await expect(page.getByText(invited.email).first()).toBeVisible()
  })

  test('唯一的登入方式不可解除', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings/account')

    const unlink = page.getByRole('button', { name: '解除連結' })
    await expect(unlink).toBeDisabled()
    await expect(page.getByText(/只有一種登入方式，所以不能解除/)).toBeVisible()
  })

  test('API 層也擋得住解除最後一種方式（不能只靠 UI 停用按鈕）', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const list = await page.evaluate(async () => {
      const res = await fetch('/api/auth/identities')
      return (await res.json()) as { data: { identities: { id: string; provider: string }[] } }
    })
    expect(list.data.identities.length).toBe(1)

    const result = await page.evaluate(async (identityId: string) => {
      const res = await fetch('/api/auth/identities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identityId }),
      })
      return { status: res.status, body: (await res.json()) as { error?: { code?: string } } }
    }, list.data.identities[0]!.id)

    expect(result.status).toBe(409)
    expect(result.body.error?.code).toBe('last_method')
  })

  test('未設定的 provider 顯示停用並說明原因，而不是隱藏', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings/account')

    // 本機沒有 Google / LINE 憑證。Q6：無假按鈕 ——
    // 停用＋原因是實話；隱藏會讓人以為產品不支援。
    for (const label of ['綁定 Google', '綁定 LINE']) {
      const button = page.getByRole('button', { name: label })
      await expect(button).toBeVisible()
      await expect(button).toBeDisabled()
    }
    await expect(page.getByText(/Google Cloud Console/)).toBeVisible()
    await expect(page.getByText(/LINE Developers Console/)).toBeVisible()
  })

  test('未登入者拿不到別人的登入方式', async ({ page }) => {
    // fetch 的相對路徑要有 origin 才能解析，about:blank 上會直接拋錯
    await page.goto('/login')
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/auth/identities')
      return res.status
    })
    expect(result).toBe(401)
  })

  test('未設定 LINE 時，start 端點不會把人送去半成品流程', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/api/auth/line/start?intent=link')

    // 應該導回登入頁並說明未設定，而不是 500 或空白頁
    await expect(page).toHaveURL(/error=line_not_configured/)
  })

  test('設定頁有通往登入方式的入口', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings')

    await page.getByRole('link', { name: '管理登入方式' }).click()
    await expect(page).toHaveURL(/\/settings\/account/)
  })
})
