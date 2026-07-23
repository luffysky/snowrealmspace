'use server'

import { revalidatePath } from 'next/cache'
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
