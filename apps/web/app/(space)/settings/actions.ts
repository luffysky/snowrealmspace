'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { weatherCitySchema } from '@snowrealm/validation'
import { getDb } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { emitEvent, audit } from '@snowrealm/analytics'
import { createAdminClient, createPublicClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'
import { accountIdentity } from '@/lib/auth/account-identity'

const privacySchema = z
  .object({
    spaceId: z.string().uuid(),
    activityTracking: z.boolean(),
    memoryEnabled: z.boolean(),
    aiAnalysisEnabled: z.boolean(),
    providerDataEnabled: z.boolean(),
    weeklyRecapEmail: z.boolean(),
  })
  .strict()

export type SettingsActionState = { status: 'idle' | 'saved' | 'error'; message?: string }

const bgAudioSchema = z
  .object({
    spaceId: z.string().uuid(),
    enabled: z.boolean(),
    assetId: z.string().uuid().nullable(),
    volume: z.coerce.number().min(0).max(1),
  })
  .strict()

/**
 * 背景音樂（Luffy 追加）。空間可選一段 audio，使用者自己決定要不要開。
 * 受 autoplay 政策約束：不自動出聲，播放器提供手動播放控制。
 */
export async function updateBackgroundAudio(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const rawAsset = (formData.get('assetId') as string | null)?.trim() || null
  const parsed = bgAudioSchema.safeParse({
    spaceId: formData.get('spaceId'),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
    assetId: rawAsset,
    volume: formData.get('volume') ?? '0.5',
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '輸入格式不正確。' }
  }
  const input = parsed.data
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()
  // 開啟卻沒選音樂 → 視為關閉，避免播放器空轉
  const enabled = input.enabled && input.assetId !== null
  const { error } = await db
    .from('space_settings')
    .update({
      background_audio_enabled: enabled,
      background_audio_asset_id: input.assetId,
      background_audio_volume: input.volume,
    })
    .eq('space_id', input.spaceId)

  if (error) return { status: 'error', message: '沒有權限修改，或儲存失敗。' }

  await emitEvent('settings.changed', input.spaceId, user.id, { keys: ['background_audio'] })
  revalidatePath('/settings')
  revalidatePath('/home')
  return { status: 'saved', message: '已儲存。' }
}

/**
 * 更新隱私設定。
 *
 * 注意這裡用受 RLS 約束的 client：只有 owner 能寫入 space_settings
 * （0003_rls_helpers.sql 的 "owner writes settings" policy）。
 * 不需要在應用層再檢查一次角色 —— 但也不能因此就不驗證輸入。
 */
export async function updatePrivacySettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = privacySchema.safeParse({
    spaceId: formData.get('spaceId'),
    activityTracking: formData.get('activityTracking') === 'on',
    memoryEnabled: formData.get('memoryEnabled') === 'on',
    aiAnalysisEnabled: formData.get('aiAnalysisEnabled') === 'on',
    providerDataEnabled: formData.get('providerDataEnabled') === 'on',
    weeklyRecapEmail: formData.get('weeklyRecapEmail') === 'on',
  })

  if (!parsed.success) {
    return { status: 'error', message: '輸入格式不正確。' }
  }

  const input = parsed.data
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()

  const { data: before } = await db
    .from('space_settings')
    .select('activity_tracking, memory_enabled, ai_analysis_enabled, provider_data_enabled, weekly_recap_email')
    .eq('space_id', input.spaceId)
    .maybeSingle()

  const { error } = await db
    .from('space_settings')
    .update({
      activity_tracking: input.activityTracking,
      memory_enabled: input.memoryEnabled,
      ai_analysis_enabled: input.aiAnalysisEnabled,
      provider_data_enabled: input.providerDataEnabled,
      weekly_recap_email: input.weeklyRecapEmail,
    })
    .eq('space_id', input.spaceId)

  if (error) {
    // RLS 擋下非 owner 的寫入時會走到這裡
    return { status: 'error', message: '沒有權限修改，或儲存失敗。' }
  }

  const after = {
    activity_tracking: input.activityTracking,
    memory_enabled: input.memoryEnabled,
    ai_analysis_enabled: input.aiAnalysisEnabled,
    provider_data_enabled: input.providerDataEnabled,
    weekly_recap_email: input.weeklyRecapEmail,
  }

  const changedKeys = before
    ? Object.keys(after).filter(
        (k) => before[k as keyof typeof before] !== after[k as keyof typeof after],
      )
    : Object.keys(after)

  if (changedKeys.length > 0) {
    await audit({
      spaceId: input.spaceId,
      actorId: user.id,
      action: 'settings.privacy.updated',
      entityType: 'space_settings',
      entityId: input.spaceId,
      before: before ?? null,
      after,
    })

    // settings.changed 不是純分析事件 —— 它會影響產品行為，所以永遠寫入
    await emitEvent('settings.changed', input.spaceId, user.id, { keys: changedKeys })
  }

  revalidatePath('/settings')
  return { status: 'saved', message: '已儲存。' }
}

const weatherSchema = z
  .object({
    spaceId: z.string().uuid(),
    weatherEnabled: z.boolean(),
    // .trim().max(80)，空字串 → null（見 @snowrealm/validation weatherCitySchema）
    weatherCity: weatherCitySchema,
  })
  .strict()

/**
 * 天氣設定（#56）。預設關閉；只存城市「名稱」，不存座標（隱私）。走 RLS：只有 owner 能寫。
 * 城市可留空（開了但還沒設 → widget 會提示補城市）。
 */
export async function updateWeatherSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = weatherSchema.safeParse({
    spaceId: formData.get('spaceId'),
    weatherEnabled: formData.get('weatherEnabled') === 'on',
    weatherCity: (formData.get('weatherCity') as string | null) ?? '',
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '輸入格式不正確。' }
  }
  const input = parsed.data
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()
  const { error } = await db
    .from('space_settings')
    .update({ weather_enabled: input.weatherEnabled, weather_city: input.weatherCity })
    .eq('space_id', input.spaceId)
  if (error) return { status: 'error', message: '沒有權限修改，或儲存失敗。' }

  await emitEvent('settings.changed', input.spaceId, user.id, { keys: ['weather'] })
  revalidatePath('/settings')
  revalidatePath('/home')
  return { status: 'saved', message: '已儲存。' }
}

const timeOrEmpty = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式需為 HH:MM')
  .or(z.literal(''))

const agentSchema = z
  .object({
    spaceId: z.string().uuid(),
    agentProactive: z.enum(['off', 'important_only', 'daily']),
    agentTone: z.enum(['warm', 'gentle', 'professional', 'playful', 'concise']),
    quietStart: timeOrEmpty,
    quietEnd: timeOrEmpty,
  })
  .strict()

/**
 * 更新 Agent 主動訊息模式與 Quiet hours（Milestone E）。
 * 「一鍵關閉」= agent_proactive 設 off。走 RLS：只有 owner 能寫。
 */
export async function updateAgentSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = agentSchema.safeParse({
    spaceId: formData.get('spaceId'),
    agentProactive: formData.get('agentProactive'),
    agentTone: formData.get('agentTone'),
    quietStart: formData.get('quietStart') ?? '',
    quietEnd: formData.get('quietEnd') ?? '',
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '輸入格式不正確。' }
  }
  const input = parsed.data
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()
  const { error } = await db
    .from('space_settings')
    .update({
      agent_proactive: input.agentProactive,
      agent_tone: input.agentTone,
      quiet_hours_start: input.quietStart || null,
      quiet_hours_end: input.quietEnd || null,
    })
    .eq('space_id', input.spaceId)

  if (error) return { status: 'error', message: '沒有權限修改，或儲存失敗。' }

  await emitEvent('settings.changed', input.spaceId, user.id, { keys: ['agent_proactive', 'agent_tone'] })
  revalidatePath('/settings')
  return { status: 'saved', message: '已儲存。' }
}

const birthdaySchema = z
  .object({
    spaceId: z.string().uuid(),
    // 空字串 = 清除（不填）
    month: z.coerce.number().int().min(1).max(12).nullable(),
    day: z.coerce.number().int().min(1).max(31).nullable(),
  })
  .strict()

/**
 * 生日（選填，只存月/日不存年）。有填 → 生日當天寄祝福；清空 → 不寄。
 */
export async function updateBirthday(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const rawMonth = (formData.get('month') as string | null)?.trim() || null
  const rawDay = (formData.get('day') as string | null)?.trim() || null
  const parsed = birthdaySchema.safeParse({
    spaceId: formData.get('spaceId'),
    month: rawMonth,
    day: rawDay,
  })
  if (!parsed.success) return { status: 'error', message: '請填有效的月與日，或都留空。' }
  const { spaceId, month, day } = parsed.data
  // 要嘛都填、要嘛都空
  if ((month === null) !== (day === null)) {
    return { status: 'error', message: '月與日要一起填，或一起留空。' }
  }
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()
  const { error } = await db
    .from('space_settings')
    .update({ birthday_month: month, birthday_day: day })
    .eq('space_id', spaceId)
  if (error) return { status: 'error', message: '沒有權限修改，或儲存失敗。' }

  revalidatePath('/settings')
  return { status: 'saved', message: month ? '已記住你的生日。' : '已清除生日。' }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前的密碼'),
    newPassword: z.string().min(8, '新密碼至少 8 個字'),
  })
  .strict()

/**
 * 更改密碼（登入方式頁）。
 *
 * 這是「知道舊密碼、當場換新的」路徑 —— 和忘記密碼（寄信重設）不同，
 * 純使用者名稱帳號（沒有真 email，不能收信）也能用這條。
 *
 * 驗證目前密碼用的是**不落地 session 的 anon client**（createPublicClient），
 * 避免動到當前登入狀態；驗過才用本人的 session client 更新密碼。
 */
export async function changePassword(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '輸入格式不正確。' }
  }
  const { currentPassword, newPassword } = parsed.data

  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }
  // email 這裡只是 Supabase 的內部登入識別（純帳號時是合成值），不對外顯示
  if (!user.email) return { status: 'error', message: '這個帳號沒有可用的登入識別，無法改密碼。' }

  if (currentPassword === newPassword) {
    return { status: 'error', message: '新密碼不能和目前的一樣。' }
  }

  // 驗證目前密碼：不落地 session，不影響現在的登入
  const verifier = createPublicClient()
  const { error: verifyErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyErr) {
    return { status: 'error', message: '目前的密碼不對。' }
  }

  const db = await getDb()
  const { error } = await db.auth.updateUser({ password: newPassword })
  if (error) {
    return { status: 'error', message: '更新密碼失敗，請稍後再試。' }
  }

  await audit({
    spaceId: null,
    actorId: user.id,
    action: 'account.password.changed',
    entityType: 'user',
    entityId: user.id,
  })

  return { status: 'saved', message: '密碼已更新。下次用新密碼登入。' }
}

const deleteSpaceSchema = z
  .object({ spaceId: z.string().uuid(), confirmName: z.string() })
  .strict()

/**
 * 刪除這個空間（10-acceptance.md 隱私與刪除）。
 *
 * 這是「軟刪除 + 7 天寬限」：立刻設 deleted_at，空間馬上進不去，
 * 但位元組與資料要等 space-purge job（滿 7 天）才永久清除，期間可還原。
 * 需要輸入空間名稱二次確認，避免誤刪。走 RLS：只有 owner 的 update 會成功。
 */
export async function deleteSpace(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = deleteSpaceSchema.safeParse({
    spaceId: formData.get('spaceId'),
    confirmName: (formData.get('confirmName') as string | null)?.trim() ?? '',
  })
  if (!parsed.success) return { status: 'error', message: '輸入格式不正確。' }
  const { spaceId, confirmName } = parsed.data

  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }

  const db = await getDb()
  // owner 讀得到自己的 space（0028 policy）；比對名稱做二次確認
  const { data: space } = await db
    .from('spaces')
    .select('name')
    .eq('id', spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!space) return { status: 'error', message: '找不到這個空間，或它已在刪除中。' }
  if (confirmName !== space.name) {
    return { status: 'error', message: '輸入的名稱不符，請完整輸入空間名稱以確認。' }
  }

  const { error } = await db
    .from('spaces')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', spaceId)
    .is('deleted_at', null)
  if (error) return { status: 'error', message: '沒有權限刪除，或操作失敗。' }

  // 稽核：刪除是不可逆的重大操作，一定要留紀錄
  await audit({
    spaceId,
    actorId: user.id,
    action: 'space.deleted',
    entityType: 'space',
    entityId: spaceId,
    after: { graceDays: 7 },
  })
  revalidatePath('/settings')
  redirect('/invite?state=space-deleted')
}

/**
 * 永久清除一個 space 的位元組與資料（R2 先於 DB），供刪除帳號用。
 * 與 worker 的 handleSpacePurge 同一套順序；這裡是同步、立即版（不等寬限）。
 */
async function purgeSpaceNow(admin: ReturnType<typeof createAdminClient>, spaceId: string) {
  const store = storage()
  const { data: assets } = await admin.from('assets').select('id, storage_key').eq('space_id', spaceId)
  const assetIds = (assets ?? []).map((a) => a.id)
  let renditionKeys: string[] = []
  if (assetIds.length > 0) {
    const { data: r } = await admin
      .from('asset_renditions')
      .select('storage_key')
      .in('asset_id', assetIds)
    renditionKeys = (r ?? []).map((x) => x.storage_key)
  }
  const keys = [...(assets ?? []).map((a) => a.storage_key), ...renditionKeys]
  if (keys.length > 0) {
    const { failed } = await store.deleteMany(keys)
    if (failed.length > 0) throw new Error(`R2 有 ${failed.length} 個物件未刪除`)
  }
  // 標記軟刪除（purge_space 的護欄要求）再永久刪（cascade + 放行 append-only）
  await admin.from('spaces').update({ deleted_at: new Date().toISOString() }).eq('id', spaceId)
  const { error } = await admin.rpc('purge_space', { target_space_id: spaceId })
  if (error) throw new Error(error.message)
}

/**
 * 刪除整個帳號（10-acceptance.md 隱私與刪除）。
 *
 * 帳號刪除是**立即且不可逆**（auth.users 一旦刪就回不來，寬限沒有意義）。
 * 流程：先永久清除本人名下所有 space（R2 先於 DB），再刪 auth.users。
 * 名下 space 先清掉，刪 user 時就不會再 cascade 到有 append-only 規則的 activity_events；
 * 他在別人 space 留下的事件則由 FK 的 ON DELETE SET NULL 匿名化（0031 放行）。
 *
 * 需要輸入帳號識別二次確認（真 email 帳號輸 email；純帳號輸使用者名稱，
 * 不逼使用者去記那個內部合成 email）。用 service role（帳號生命週期，rule 10 容許）。
 */
export async function deleteAccount(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const confirmValue = (formData.get('confirmValue') as string | null)?.trim() ?? ''
  const user = await getUser()
  if (!user) return { status: 'error', message: '請先登入。' }
  const acct = accountIdentity(user.email, user.username)
  if (!acct.value || confirmValue.toLowerCase() !== acct.value.toLowerCase()) {
    return { status: 'error', message: `輸入的${acct.label}不符，請輸入你的${acct.label}以確認。` }
  }

  const admin = createAdminClient()

  // 本人名下（owner）的所有 space
  const { data: owned } = await admin.from('spaces').select('id').eq('owner_id', user.id)

  try {
    for (const s of owned ?? []) {
      await purgeSpaceNow(admin, s.id)
    }
  } catch (err) {
    console.error('[delete-account] 清除 space 失敗', err)
    return { status: 'error', message: '清除空間資料時失敗，帳號未刪除，請稍後再試。' }
  }

  await audit({
    spaceId: null,
    actorId: user.id,
    action: 'account.deleted',
    entityType: 'user',
    entityId: user.id,
    after: { spacesPurged: (owned ?? []).length },
  })

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[delete-account] 刪除 auth 使用者失敗', error.message)
    return { status: 'error', message: '刪除帳號失敗，請稍後再試或聯絡我們。' }
  }

  redirect('/login?state=account-deleted')
}

/**
 * 在寬限期內還原已軟刪除的空間。清掉 deleted_at，space-purge 就不會清它。
 */
export async function restoreSpace(spaceId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, message: '請先登入。' }
  const db = await getDb()
  const { data, error } = await db
    .from('spaces')
    .update({ deleted_at: null })
    .eq('id', spaceId)
    .not('deleted_at', 'is', null)
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, message: '還原失敗，或已超過寬限期被清除。' }
  await audit({
    spaceId,
    actorId: user.id,
    action: 'space.restored',
    entityType: 'space',
    entityId: spaceId,
  })
  revalidatePath('/')
  return { ok: true }
}
