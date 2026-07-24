'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { emitEvent, audit } from '@snowrealm/analytics'

const privacySchema = z
  .object({
    spaceId: z.string().uuid(),
    activityTracking: z.boolean(),
    memoryEnabled: z.boolean(),
    aiAnalysisEnabled: z.boolean(),
    providerDataEnabled: z.boolean(),
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
    .select('activity_tracking, memory_enabled, ai_analysis_enabled, provider_data_enabled')
    .eq('space_id', input.spaceId)
    .maybeSingle()

  const { error } = await db
    .from('space_settings')
    .update({
      activity_tracking: input.activityTracking,
      memory_enabled: input.memoryEnabled,
      ai_analysis_enabled: input.aiAnalysisEnabled,
      provider_data_enabled: input.providerDataEnabled,
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

const timeOrEmpty = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式需為 HH:MM')
  .or(z.literal(''))

const agentSchema = z
  .object({
    spaceId: z.string().uuid(),
    agentProactive: z.enum(['off', 'important_only', 'daily']),
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
      quiet_hours_start: input.quietStart || null,
      quiet_hours_end: input.quietEnd || null,
    })
    .eq('space_id', input.spaceId)

  if (error) return { status: 'error', message: '沒有權限修改，或儲存失敗。' }

  await emitEvent('settings.changed', input.spaceId, user.id, { keys: ['agent_proactive'] })
  revalidatePath('/settings')
  return { status: 'saved', message: '已儲存。' }
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
