import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from './server.js'
import type { Tables } from '@snowrealm/shared-types'

/**
 * 邀請與 Space 佈建。
 *
 * 這一整支都用 service role：使用者在接受邀請的當下還不是任何 space 的成員，
 * 因此無法通過 RLS。這是 ADR-006 允許繞過 RLS 的少數場景之一。
 */

const INVITE_TTL_DAYS = 14

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 常數時間比較，避免以回應時間推測 token。 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export type CreateInviteResult = {
  inviteId: string
  /** 明文 token。**只在此處回傳一次**，之後只有 hash 存在 DB。 */
  token: string
  email: string
  expiresAt: string
}

export async function createInvite(input: {
  email: string
  spaceId?: string | null
  role?: 'owner' | 'collaborator' | 'guest'
  createdBy?: string | null
  ttlDays?: number
}): Promise<CreateInviteResult> {
  const db = createAdminClient()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + (input.ttlDays ?? INVITE_TTL_DAYS) * 86_400_000,
  ).toISOString()

  const email = input.email.trim().toLowerCase()

  const { data, error } = await db
    .from('space_invites')
    .insert({
      email,
      space_id: input.spaceId ?? null,
      role: input.role ?? 'owner',
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`建立邀請失敗：${error?.message ?? '未知錯誤'}`)

  return { inviteId: data.id, token, email, expiresAt }
}

export type InviteCheck =
  | { ok: true; invite: Tables<'space_invites'> }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_accepted' | 'email_mismatch' }

/**
 * 驗證邀請 token。
 * `email` 有值時額外檢查是否與邀請對象相符（magic link 回來後用）。
 */
export async function checkInvite(token: string, email?: string): Promise<InviteCheck> {
  const db = createAdminClient()
  const { data } = await db
    .from('space_invites')
    .select('*')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  if (!data) return { ok: false, reason: 'not_found' }
  if (!safeEqual(data.token_hash, hashInviteToken(token))) return { ok: false, reason: 'not_found' }
  if (data.accepted_at) return { ok: false, reason: 'already_accepted' }
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (email && data.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' }
  }

  return { ok: true, invite: data }
}

/** slug 由名稱衍生，衝突時加短亂數後綴。 */
async function uniqueSlug(base: string): Promise<string> {
  const db = createAdminClient()
  const normalized =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'space'

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? normalized : `${normalized}-${randomBytes(3).toString('hex')}`
    // slug 必須以英數開頭，長度 2–63
    const valid = /^[a-z0-9][a-z0-9-]{1,62}$/.test(candidate) ? candidate : `s-${candidate}`
    const { data } = await db.from('spaces').select('id').eq('slug', valid).maybeSingle()
    if (!data) return valid
  }
  return `space-${randomBytes(8).toString('hex')}`
}

export type ProvisionResult = { spaceId: string; slug: string; created: boolean }

/**
 * 為使用者佈建第一個 Space，含 settings 與 agent profile。
 *
 * 冪等：使用者已有 space 時直接回傳既有的，不重複建立。
 * 這很重要 —— magic link 可能被重複點擊。
 */
export async function provisionSpaceForUser(input: {
  userId: string
  email: string
  displayName?: string | null
  spaceName?: string
  timezone?: string
}): Promise<ProvisionResult> {
  const db = createAdminClient()

  const { data: existing } = await db
    .from('space_members')
    .select('space_id, spaces!inner(slug, deleted_at)')
    .eq('user_id', input.userId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const space = existing.spaces as unknown as { slug: string; deleted_at: string | null }
    if (!space.deleted_at) {
      return { spaceId: existing.space_id, slug: space.slug, created: false }
    }
  }

  const displayName = input.displayName ?? input.email.split('@')[0] ?? 'my'
  const name = input.spaceName ?? `${displayName} 的空間`
  const slug = await uniqueSlug(input.spaceName ?? displayName)
  const timezone = input.timezone ?? 'Asia/Taipei'

  const { data: space, error: spaceError } = await db
    .from('spaces')
    .insert({ owner_id: input.userId, name, slug, timezone })
    .select('id, slug')
    .single()

  if (spaceError || !space) {
    throw new Error(`建立 space 失敗：${spaceError?.message ?? '未知錯誤'}`)
  }

  // 三張附屬表。任一失敗都要把 space 收回，避免留下半殘的 space。
  const { error: memberError } = await db
    .from('space_members')
    .insert({ space_id: space.id, user_id: input.userId, role: 'owner' })

  const { error: settingsError } = await db
    .from('space_settings')
    .insert({ space_id: space.id })

  const { error: agentError } = await db.from('agent_profiles').insert({ space_id: space.id })

  const failure = memberError ?? settingsError ?? agentError
  if (failure) {
    await db.from('spaces').delete().eq('id', space.id)
    throw new Error(`佈建 space 附屬資料失敗：${failure.message}`)
  }

  await db.from('profiles').update({ timezone }).eq('id', input.userId)

  return { spaceId: space.id, slug: space.slug, created: true }
}

/** 標記邀請已使用。必須在 space 佈建成功之後才呼叫。 */
export async function markInviteAccepted(inviteId: string, userId: string): Promise<void> {
  const db = createAdminClient()
  await db
    .from('space_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', inviteId)
    .is('accepted_at', null)
}

/** 邀請對象加入既有 space（invite.space_id 非 null 時）。 */
export async function joinExistingSpace(input: {
  spaceId: string
  userId: string
  role: 'owner' | 'collaborator' | 'guest'
}): Promise<void> {
  const db = createAdminClient()
  const { error } = await db
    .from('space_members')
    .upsert(
      { space_id: input.spaceId, user_id: input.userId, role: input.role },
      { onConflict: 'space_id,user_id' },
    )
  if (error) throw new Error(`加入 space 失敗：${error.message}`)
}
