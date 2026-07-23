import { createAdminClient } from './server.js'

/**
 * 登入方式的綁定與解綁。實作 13-third-party-auth.md §3、§5。
 *
 * 使用者可以先用 magic link 註冊，之後把 Google / LINE 綁上來，
 * 綁定後這三種方式都能登入同一個帳號。
 */

export type IdentityProvider = 'email' | 'google' | 'line'

export type LinkedIdentity = {
  id: string
  provider: IdentityProvider
  providerUid: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  linkedAt: string
  lastUsedAt: string | null
}

type IdentityRow = {
  id: string
  provider: string
  provider_uid: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  linked_at: string
  last_used_at: string | null
}

function toIdentity(row: IdentityRow): LinkedIdentity {
  return {
    id: row.id,
    provider: row.provider as IdentityProvider,
    providerUid: row.provider_uid,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    linkedAt: row.linked_at,
    lastUsedAt: row.last_used_at,
  }
}

/** 列出使用者已綁定的登入方式。 */
export async function listIdentities(userId: string): Promise<LinkedIdentity[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_identities')
    .select('id, provider, provider_uid, email, display_name, avatar_url, linked_at, last_used_at')
    .eq('user_id', userId)
    .order('linked_at', { ascending: true })

  if (error) throw new Error(`讀取登入方式失敗：${error.message}`)
  return (data ?? []).map((row) => toIdentity(row as IdentityRow))
}

export type UpsertIdentityInput = {
  userId: string
  provider: IdentityProvider
  providerUid: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  lineUserId?: string | null
}

export type UpsertResult =
  | { ok: true; identity: LinkedIdentity; created: boolean }
  /** 這個第三方帳號已經綁在**別人**的帳號上。 */
  | { ok: false; reason: 'taken'; ownedByOtherUser: true }

/**
 * 綁定一個身分。
 *
 * `unique (provider, provider_uid)` 讓「一個 Google 帳號綁兩個 SnowRealm 帳號」
 * 在 DB 層不可能發生。這裡先查再寫是為了給出好的錯誤訊息，
 * **不是**為了取代那條約束 —— 併發下先查再寫仍會競態，最後靠約束擋。
 */
export async function upsertIdentity(input: UpsertIdentityInput): Promise<UpsertResult> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('user_identities')
    .select('id, user_id')
    .eq('provider', input.provider)
    .eq('provider_uid', input.providerUid)
    .maybeSingle()

  if (existing && (existing as { user_id: string }).user_id !== input.userId) {
    return { ok: false, reason: 'taken', ownedByOtherUser: true }
  }

  const row = {
    user_id: input.userId,
    provider: input.provider,
    provider_uid: input.providerUid,
    email: input.email ?? null,
    display_name: input.displayName ?? null,
    avatar_url: input.avatarUrl ?? null,
    line_user_id: input.lineUserId ?? null,
    last_used_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('user_identities')
    .upsert(row as never, { onConflict: 'provider,provider_uid' })
    .select('id, provider, provider_uid, email, display_name, avatar_url, linked_at, last_used_at')
    .single()

  if (error) {
    // 23505 = unique violation。併發時另一個請求搶先綁走了。
    if ((error as { code?: string }).code === '23505') {
      return { ok: false, reason: 'taken', ownedByOtherUser: true }
    }
    throw new Error(`綁定失敗：${error.message}`)
  }

  return { ok: true, identity: toIdentity(data as IdentityRow), created: !existing }
}

export type UnlinkResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  /** 這是最後一種登入方式，解綁會把自己鎖在門外。 */
  | { ok: false; reason: 'last_method' }

/**
 * 解綁。
 *
 * §5 的硬性要求：**必須至少保留一種登入方式。**
 * 少了這個檢查，使用者解綁最後一個 provider 之後就再也登不進來，
 * 而且我們沒有任何自助復原的介面。
 */
export async function unlinkIdentity(userId: string, identityId: string): Promise<UnlinkResult> {
  const admin = createAdminClient()

  const { data: target } = await admin
    .from('user_identities')
    .select('id, provider')
    .eq('id', identityId)
    .eq('user_id', userId) // 不可解別人的綁定
    .maybeSingle()

  if (!target) return { ok: false, reason: 'not_found' }

  const { count } = await admin
    .from('user_identities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) <= 1) return { ok: false, reason: 'last_method' }

  const { error } = await admin
    .from('user_identities')
    .delete()
    .eq('id', identityId)
    .eq('user_id', userId)

  if (error) throw new Error(`解綁失敗：${error.message}`)
  return { ok: true }
}

/** 以第三方身分反查使用者。LINE 登入用。 */
export async function findUserByIdentity(
  provider: IdentityProvider,
  providerUid: string,
): Promise<{ userId: string; email: string | null } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_identities')
    .select('user_id, email')
    .eq('provider', provider)
    .eq('provider_uid', providerUid)
    .maybeSingle()

  if (!data) return null
  const row = data as { user_id: string; email: string | null }
  return { userId: row.user_id, email: row.email }
}

export async function touchIdentity(provider: IdentityProvider, providerUid: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('user_identities')
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq('provider', provider)
    .eq('provider_uid', providerUid)
}

/**
 * 把 Supabase `auth.identities` 的內容同步進我們的投影表。
 *
 * Google 走 Supabase 原生流程，綁定結果寫在 auth.identities，
 * 我們的表不會自動更新 —— 每次登入與綁定完成後都要呼叫這支。
 *
 * email 身分也一併記錄，否則「至少保留一種登入方式」的計數會漏掉
 * magic link，使用者綁了 Google 之後會被允許解綁到零。
 */
export async function syncFromAuthIdentities(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return

  const user = data.user
  const identities = user.identities ?? []

  for (const identity of identities) {
    const provider = identity.provider
    if (provider !== 'email' && provider !== 'google') continue

    const meta = (identity.identity_data ?? {}) as Record<string, unknown>
    await upsertIdentity({
      userId,
      provider,
      // email 身分沒有 sub 概念，用 email 當唯一鍵
      providerUid: (identity.identity_id ?? identity.id) as string,
      email: (meta['email'] as string | undefined) ?? user.email ?? null,
      displayName:
        (meta['full_name'] as string | undefined) ?? (meta['name'] as string | undefined) ?? null,
      avatarUrl: (meta['avatar_url'] as string | undefined) ?? null,
    })
  }

  // auth.identities 已移除的，我們這邊也要移除 —— 否則使用者在
  // Supabase 端解綁後，設定頁仍會顯示已綁定。
  const keep = identities
    .filter((i) => i.provider === 'email' || i.provider === 'google')
    .map((i) => (i.identity_id ?? i.id) as string)

  const { data: mine } = await admin
    .from('user_identities')
    .select('id, provider, provider_uid')
    .eq('user_id', userId)
    .in('provider', ['email', 'google'])

  for (const row of (mine ?? []) as { id: string; provider_uid: string }[]) {
    if (!keep.includes(row.provider_uid)) {
      await admin.from('user_identities').delete().eq('id', row.id)
    }
  }
}

/**
 * 使用者所屬的第一個 space。只用於稽核紀錄的歸屬。
 *
 * audit_logs.space_id 可為 null，但 RLS 的 owner 檢視條件是
 * `space_id is not null`，留 null 等於這筆紀錄使用者永遠看不到 ——
 * 綁定/解綁登入方式正是使用者最該看得到的那類事件。
 */
export async function primarySpaceIdOf(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('space_members')
    .select('space_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return (data as { space_id: string } | null)?.space_id ?? null
}
