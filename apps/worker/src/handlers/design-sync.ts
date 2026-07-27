import type { Job } from 'pg-boss'
import { ProviderApiError } from '@snowrealm/provider-core'
import { createAdminClient } from '@snowrealm/db/server'
import {
  MAX_SYNC_ATTEMPTS,
  ensureAccessToken,
  nextDelayMs,
  notifySyncOutcome,
  parseRetryAfterSeconds,
  shouldGiveUp,
  syncOneFile,
  type ConnectionRow,
  type SyncContext,
} from '@snowrealm/design-sync'
import { getBoss, QUEUES } from '../boss.js'

/**
 * design.sync worker job（Milestone F sync 半段 S2）。
 *
 * 每個 job 處理「單一檔案」（connectionId + externalId），以利獨立去重/退避/連 5 次失敗轉 error。
 * 重試由本 handler 主導（非 pg-boss 自動重試）：暫時性錯誤（429/5xx/網路）依 Retry-After 或指數退避
 * 重新入列（attempt+1）；永久性錯誤（4xx）或達 MAX_SYNC_ATTEMPTS → 標 error + 通知使用者。
 *
 * worker 情境用 service role client（規則#10），但一切查詢/寫入都帶 space_id，維持隔離語意。
 * handler 對「預期內」錯誤一律不 throw（自行重新入列），避免與 pg-boss 自動重試疊加。
 */
export async function handleDesignSync(jobs: Job<DesignSyncPayload>[]): Promise<void> {
  for (const job of jobs) {
    await processOne(job.data).catch((err: unknown) => {
      // 真正非預期的例外才讓 pg-boss 記錄（infra 層安全網）
      console.error('[design.sync] handler 例外', job.data, err)
      throw err
    })
  }
}

export type DesignSyncPayload = {
  connectionId: string
  spaceId: string
  externalId: string
  attempt: number
}

type FullConnection = ConnectionRow & { space_id: string; user_id: string; status: string }

async function processOne(payload: DesignSyncPayload): Promise<void> {
  const admin = createAdminClient()
  const { connectionId, spaceId, externalId } = payload

  const { data: conn } = await admin
    .from('design_connections')
    .select('id, provider, space_id, user_id, access_token_encrypted, refresh_token_encrypted, expires_at, status')
    .eq('id', connectionId)
    .eq('space_id', spaceId)
    .maybeSingle<FullConnection>()

  if (!conn) {
    console.warn('[design.sync] 連線不存在，略過', connectionId)
    return
  }
  if (conn.status === 'revoked') {
    console.warn('[design.sync] 連線已中斷，略過', connectionId)
    return
  }

  // token 層失敗（多半需重新連接）→ 標連線 error + 通知，不重試
  const token = await ensureAccessToken(admin, conn)
  if (!token.ok) {
    await admin.from('design_connections').update({ status: 'error', last_error: token.error } as never).eq('id', conn.id)
    await markFileError(admin, conn.id, externalId, token.error, true)
    await notifyFail(conn, externalId, token.error)
    console.error('[design.sync] 取得授權失敗，放棄', conn.id, token.error)
    return
  }

  const ctx: SyncContext = { db: admin, userId: conn.user_id, spaceId }

  try {
    const result = await syncOneFile(ctx, conn, token.accessToken, externalId)

    if (result.status === 'error') {
      // syncOneFile 已對本地錯誤（下載/存檔/建版本）落 last_error；視為暫時性，套退避
      await scheduleRetryOrGiveUp(admin, conn, payload, 500, result.message ?? '同步失敗')
      return
    }

    // 成功 / unchanged：清除 last_error、記連線同步時間
    if (result.designFileId) {
      await admin.from('design_files').update({ last_error: null } as never).eq('id', result.designFileId)
    }
    await admin.from('design_connections').update({ last_synced_at: new Date().toISOString() } as never).eq('id', conn.id)
    console.log('[design.sync] 完成', conn.id, externalId, result.status)
  } catch (err) {
    if (err instanceof ProviderApiError) {
      await scheduleRetryOrGiveUp(admin, conn, payload, err.status, err.message, err.retryAfterHeader)
      return
    }
    // 非 provider 的未預期錯誤：當暫時性處理（退避），但記下來
    console.error('[design.sync] 未預期錯誤', conn.id, externalId, err)
    await scheduleRetryOrGiveUp(admin, conn, payload, 500, (err as Error).message)
  }
}

type Admin = ReturnType<typeof createAdminClient>

/** 落 design_file.last_error（不靜默）；permanent 時同時把 sync_status 轉 error。 */
async function markFileError(
  admin: Admin,
  connectionId: string,
  externalId: string,
  message: string,
  permanent: boolean,
): Promise<void> {
  const patch = permanent ? { last_error: message, sync_status: 'error' } : { last_error: message }
  await admin
    .from('design_files')
    .update(patch as never)
    .eq('connection_id', connectionId)
    .eq('external_id', externalId)
}

async function notifyFail(conn: FullConnection, externalId: string, message: string): Promise<void> {
  await notifySyncOutcome({
    spaceId: conn.space_id,
    userId: conn.user_id,
    category: 'sync_failed',
    title: `${conn.provider === 'figma' ? 'Figma' : 'Canva'} 同步失敗`,
    body: `檔案 ${externalId} 同步未成功：${message}`,
    link: '/settings/integrations',
  })
}

/**
 * 決定重試或放棄：
 * - 永久性錯誤（4xx 非 429）或達 MAX_SYNC_ATTEMPTS → 放棄：design_file 標 error + 通知。
 * - 否則：依 Retry-After（429）或指數退避，重新入列 attempt+1（delayed）。
 */
async function scheduleRetryOrGiveUp(
  admin: Admin,
  conn: FullConnection,
  payload: DesignSyncPayload,
  status: number,
  message: string,
  retryAfterHeader?: string | null,
): Promise<void> {
  const attempt = payload.attempt ?? 1

  if (shouldGiveUp(status, attempt)) {
    await markFileError(admin, conn.id, payload.externalId, message, true)
    await notifyFail(conn, payload.externalId, message)
    console.error(`[design.sync] 放棄（attempt ${attempt}/${MAX_SYNC_ATTEMPTS}, status ${status}）`, conn.id, payload.externalId, message)
    return
  }

  // 暫時性、未達上限 → 記 last_error（保留 sync_status='active'）並排下次
  await markFileError(admin, conn.id, payload.externalId, `重試中（第 ${attempt} 次）：${message}`, false)
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader ?? null)
  const startAfter = Math.ceil(nextDelayMs({ status, attempt, retryAfterSeconds }) / 1000)
  await getBoss().send(
    QUEUES.designSync,
    { ...payload, attempt: attempt + 1 },
    { startAfter, retryLimit: 2 },
  )
  console.warn(
    `[design.sync] 重試排程 attempt ${attempt}→${attempt + 1}，+${startAfter}s（status ${status}${retryAfterSeconds != null ? `, Retry-After ${retryAfterSeconds}s` : ''}）`,
    conn.id,
    payload.externalId,
  )
}
