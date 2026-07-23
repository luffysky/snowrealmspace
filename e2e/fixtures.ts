import { test as base, expect, type Page } from '@playwright/test'
import { config } from 'dotenv'
import { E2E_BASE_URL } from './config'

config({ path: '.env.local' })

const MAILPIT = 'http://127.0.0.1:54324'

export type InvitedUser = {
  email: string
  inviteUrl: string
  inviteId: string
}

/** 動態載入，避免在 Playwright 收集測試檔時就連上資料庫。 */
async function db() {
  const { createAdminClient } = await import('@snowrealm/db/server')
  return createAdminClient()
}

export async function createInvitedUser(prefix = 'e2e'): Promise<InvitedUser> {
  const { createInvite } = await import('@snowrealm/db/provisioning')
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.local`
  const invite = await createInvite({ email })
  // 一定要用 E2E 的 base URL，不是 NEXT_PUBLIC_APP_URL（那是 dev 的 :3000）
  return {
    email,
    inviteUrl: `${E2E_BASE_URL}/invite?token=${invite.token}`,
    inviteId: invite.inviteId,
  }
}

/**
 * 從 Mailpit 取回真實寄出的登入連結。
 *
 * 不用 admin.generateLink 繞過寄信 —— 那樣就沒有驗證到「信真的寄得出去」，
 * 而那是這條流程最容易在部署後才壞掉的一段。
 */
export async function fetchMagicLink(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const listRes = await fetch(`${MAILPIT}/api/v1/messages?limit=50`)
      const list = (await listRes.json()) as {
        messages?: { ID: string; To?: { Address?: string }[] }[]
      }
      const msg = list.messages?.find((m) =>
        m.To?.some((t) => t.Address?.toLowerCase() === email.toLowerCase()),
      )
      if (msg) {
        const bodyRes = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)
        const body = (await bodyRes.json()) as { HTML?: string; Text?: string }
        const raw = `${body.HTML ?? ''}\n${body.Text ?? ''}`
        const match = raw.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/)
        if (match) return match[0].replace(/&amp;/g, '&')
      }
    } catch {
      /* Mailpit 尚未就緒 */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${timeoutMs}ms 內沒有收到寄給 ${email} 的登入信`)
}

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => {})
}

/**
 * 走完整條登入流程：填 email → 收信 → 點連結 → 進入 Home。
 * 這是真實使用者的路徑，不走任何捷徑。
 */
export async function signInThroughUi(page: Page, user: InvitedUser): Promise<void> {
  await clearMailbox()
  await page.goto(user.inviteUrl)

  await page.getByLabel('Email').fill(user.email)
  await page.getByRole('button', { name: '寄送登入連結' }).click()
  await expect(page.getByRole('main').getByRole('status')).toContainText('登入連結已寄到')

  const magicLink = await fetchMagicLink(user.email)
  await page.goto(magicLink)
  await page.waitForURL('**/home', { timeout: 30_000 })
}

export async function cleanupUser(email: string): Promise<void> {
  const admin = await db()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const user = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return

  const { data: membership } = await admin
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) await admin.from('spaces').delete().eq('id', membership.space_id)
  await admin.auth.admin.deleteUser(user.id)
}

/** 每個測試自動取得一位已受邀的使用者，結束後自動清理。 */
export const test = base.extend<{ invited: InvitedUser }>({
  invited: async ({}, use) => {
    const user = await createInvitedUser()
    await use(user)
    await cleanupUser(user.email).catch(() => {})
  },
})

export { expect }
