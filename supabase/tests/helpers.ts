import { createAdminClient, createTokenClient, type Db } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'

export type TestActor = {
  userId: string
  email: string
  spaceId: string
  /** 受 RLS 約束的 client —— 測試斷言都用這個。 */
  db: Db
}

let counter = 0

function uniqueEmail(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}@rls-test.local`
}

/**
 * 建立一個測試使用者 + 他自己的 space，並回傳受 RLS 約束的 client。
 *
 * 關鍵在於 `db` 用的是使用者的 access token，不是 service role。
 * 用 service role 測 RLS 等於沒測 —— 它會繞過所有 policy。
 */
export async function createTestActor(prefix = 'actor'): Promise<TestActor> {
  const admin = createAdminClient()
  const email = uniqueEmail(prefix)
  const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`建立測試使用者失敗：${createError?.message}`)
  }

  const provisioned = await provisionSpaceForUser({ userId: created.user.id, email })

  // 以密碼登入取得真實的 access token（含 RLS 需要的 claim）
  const anon = createTokenClient('')
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !session.session) {
    throw new Error(`測試使用者登入失敗：${signInError?.message}`)
  }

  return {
    userId: created.user.id,
    email,
    spaceId: provisioned.spaceId,
    db: createTokenClient(session.session.access_token),
  }
}

/** 未登入的 client（anon key，無 Authorization header）。 */
export function anonClient(): Db {
  return createTokenClient('')
}

export async function cleanupActor(actor: TestActor): Promise<void> {
  const admin = createAdminClient()
  await admin.from('spaces').delete().eq('id', actor.spaceId)
  await admin.auth.admin.deleteUser(actor.userId)
}

/** 以 service role 種一筆資料，用於測試「別人的資料看不看得到」。 */
export function adminDb(): Db {
  return createAdminClient()
}
