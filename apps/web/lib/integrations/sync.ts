import { createHash } from 'node:crypto'
import {
  CanvaAdapter,
  FigmaAdapter,
  ProviderApiError,
  type DesignProviderAdapter,
  type FetchedFile,
} from '@snowrealm/provider-core'
import { sniffMimeType, kindForMime } from '@snowrealm/validation'
import { storage, storageKeys } from '@snowrealm/storage'
import { emitEvent } from '@snowrealm/analytics'
import type { Db } from '@snowrealm/db/server'
import type { ApiContext } from '@/lib/api/context'
import { createSnapshotFromAsset } from '@/lib/design/snapshots'
import {
  type ProviderKey,
  decryptToken,
  encryptToken,
  providerConfig,
  refreshToken,
} from '@/lib/integrations/providers'

/**
 * Milestone F — sync 半段 S1 的 orchestration（不含 worker；觸發是使用者操作，用 getDb）。
 *
 * 資料流：access token（必要時 refresh 並加密回存）→ adapter.fetchFile → 下載預覽位元組
 * → 走 StorageAdapter 存入 assets（ADR-005：位元組只在 assets）→ createSnapshotFromAsset 建版本。
 * design_snapshots 只存指標/中繼，沒有任何指向使用者檔案的 URL 欄位。
 */

const REFRESH_BUFFER_MS = 60_000 // 提早 1 分鐘視為過期，避免邊界競態
const MAX_RENDITION_BYTES = 25 * 1024 * 1024 // 預覽圖上限，避免異常大檔

export type ConnectionRow = {
  id: string
  provider: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  expires_at: string | null
}

export function getAdapter(provider: ProviderKey): DesignProviderAdapter {
  return provider === 'figma' ? new FigmaAdapter() : new CanvaAdapter()
}

export type TokenResult = { ok: true; accessToken: string } | { ok: false; error: string }

/**
 * 取得可用的 access token。過期且有 refresh token → 先 refresh，加密回存 design_connections（owner RLS）。
 * 任一步失敗都回明確錯誤（不靜默）。
 */
export async function ensureAccessToken(db: Db, conn: ConnectionRow): Promise<TokenResult> {
  const cfg = providerConfig(conn.provider as ProviderKey)
  if (!cfg) return { ok: false, error: '這個 provider 的憑證尚未在伺服器設定。' }
  if (!conn.access_token_encrypted) return { ok: false, error: '連線沒有 access token，請重新連接。' }

  const access = decryptToken(conn.access_token_encrypted)
  if (!access) return { ok: false, error: '無法解密 token（加密金鑰可能換過），請重新連接。' }

  const stillValid = !conn.expires_at || new Date(conn.expires_at).getTime() - Date.now() > REFRESH_BUFFER_MS
  if (stillValid) return { ok: true, accessToken: access }

  // 過期 → refresh
  if (!conn.refresh_token_encrypted) return { ok: false, error: '授權已過期且沒有 refresh token，請重新連接。' }
  const refresh = decryptToken(conn.refresh_token_encrypted)
  if (!refresh) return { ok: false, error: '無法解密 refresh token，請重新連接。' }

  const refreshed = await refreshToken(cfg, refresh)
  if (!refreshed.ok) return { ok: false, error: `更新授權失敗：${refreshed.error}` }

  const newAccessEnc = encryptToken(refreshed.tokens.accessToken)
  if (!newAccessEnc) return { ok: false, error: '伺服器缺加密金鑰，無法保存更新後的 token。' }
  const newRefreshEnc = refreshed.tokens.refreshToken
    ? encryptToken(refreshed.tokens.refreshToken)
    : conn.refresh_token_encrypted

  await db
    .from('design_connections')
    .update({
      access_token_encrypted: newAccessEnc,
      refresh_token_encrypted: newRefreshEnc,
      expires_at: new Date(Date.now() + refreshed.tokens.expiresInSec * 1000).toISOString(),
      status: 'active',
      last_error: null,
    } as never)
    .eq('id', conn.id)

  return { ok: true, accessToken: refreshed.tokens.accessToken }
}

type AssetResult = { ok: true; assetId: string } | { ok: false; error: string }

/**
 * 下載預覽位元組並存成 asset（走 StorageAdapter，位元組只在 assets）。
 * 以 checksum 去重：同 space 內同內容重用既有 asset。
 */
async function storeRenditionAsset(ctx: ApiContext, url: string, filename: string): Promise<AssetResult> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    return { ok: false, error: `下載預覽失敗：${(err as Error).message}` }
  }
  if (!res.ok) return { ok: false, error: `下載預覽失敗（HTTP ${res.status}）。` }

  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength === 0) return { ok: false, error: '預覽內容是空的。' }
  if (buf.byteLength > MAX_RENDITION_BYTES) return { ok: false, error: '預覽檔過大，暫不處理。' }

  // 用內容嗅探真實 MIME，不信任 header；且必須是圖片
  const sniffed = sniffMimeType(buf.subarray(0, 32))
  if (!sniffed || kindForMime(sniffed) !== 'image') {
    return { ok: false, error: '預覽格式無法辨識為圖片。' }
  }

  const checksum = createHash('sha256').update(buf).digest('hex')

  // 去重：同 space 已有相同內容的 ready asset → 直接重用
  const { data: existing } = await ctx.db
    .from('assets')
    .select('id')
    .eq('space_id', ctx.spaceId)
    .eq('checksum', checksum)
    .eq('status', 'ready')
    .is('deleted_at', null)
    .maybeSingle()
  if (existing) return { ok: true, assetId: existing.id }

  // 新建 asset（getDb，member RLS）：先 pending 拿 id，上傳位元組，再標 ready
  const { data: asset, error: insErr } = await ctx.db
    .from('assets')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      kind: 'image',
      mime_type: sniffed,
      bytes: buf.byteLength,
      checksum,
      storage_key: `pending/${ctx.spaceId}/${checksum}-${Date.now()}`,
      original_filename: filename.slice(0, 255),
      status: 'pending',
    } as never)
    .select('id')
    .single()
  if (insErr || !asset) {
    // 併發：另一路同 checksum 先建好了 → 撿回來重用
    const { data: raced } = await ctx.db
      .from('assets')
      .select('id')
      .eq('space_id', ctx.spaceId)
      .eq('checksum', checksum)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .maybeSingle()
    if (raced) return { ok: true, assetId: raced.id }
    return { ok: false, error: '建立預覽檔記錄失敗。' }
  }

  const key = storageKeys.assetOriginal(ctx.userId, ctx.spaceId, asset.id)
  try {
    // 使用者內容，不設 immutable cacheControl（刪除後不該殘留在 CDN）
    await storage().put({ key, body: buf, contentType: sniffed })
  } catch (err) {
    await ctx.db.from('assets').update({ status: 'failed', failure_reason: 'storage_put' } as never).eq('id', asset.id)
    return { ok: false, error: `存檔失敗：${(err as Error).message}` }
  }

  const { error: readyErr } = await ctx.db
    .from('assets')
    .update({ storage_key: key, status: 'ready' } as never)
    .eq('id', asset.id)
  if (readyErr) return { ok: false, error: '標記檔案就緒失敗。' }

  return { ok: true, assetId: asset.id }
}

export type FileSyncResult = {
  externalId: string
  designFileId: string | null
  snapshotId: string | null
  status: 'created' | 'updated' | 'unchanged' | 'error'
  message?: string
}

/** upsert design_file（一 connection + external_id 一筆）。回傳 fileId 與是否新建。 */
async function upsertDesignFile(
  ctx: ApiContext,
  connectionId: string,
  provider: ProviderKey,
  fetched: FetchedFile,
): Promise<{ fileId: string; created: boolean } | null> {
  const { data: existing } = await ctx.db
    .from('design_files')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('external_id', fetched.externalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    await ctx.db
      .from('design_files')
      .update({
        title: fetched.title,
        source_url: fetched.sourceUrl,
        sync_status: 'active',
        last_synced_at: new Date().toISOString(),
        last_error: null,
      } as never)
      .eq('id', existing.id)
    return { fileId: existing.id, created: false }
  }

  const { data: created, error } = await ctx.db
    .from('design_files')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      provider,
      connection_id: connectionId,
      external_id: fetched.externalId,
      title: fetched.title,
      source_url: fetched.sourceUrl,
      sync_status: 'active',
      last_synced_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()
  if (error || !created) {
    console.error('[sync] 建立 design_file 失敗', error?.message)
    return null
  }
  return { fileId: created.id, created: true }
}

/**
 * 同步使用者「明確挑選」的檔案（externalIds 由呼叫端傳入，禁止「同步全部」）。
 * 逐檔處理：抓取 → upsert design_file → 存預覽 asset → 建 snapshot。單檔失敗不影響其他檔。
 */
export async function syncSelectedFiles(
  ctx: ApiContext,
  conn: ConnectionRow,
  accessToken: string,
  externalIds: string[],
): Promise<FileSyncResult[]> {
  const provider = conn.provider as ProviderKey
  const adapter = getAdapter(provider)
  const results: FileSyncResult[] = []

  for (const externalId of externalIds) {
    try {
      const fetched = await adapter.fetchFile(accessToken, externalId)
      const upserted = await upsertDesignFile(ctx, conn.id, provider, fetched)
      if (!upserted) {
        results.push({ externalId, designFileId: null, snapshotId: null, status: 'error', message: '建立作品記錄失敗。' })
        continue
      }

      // 注：design.linked 是上傳流程（帶單一 assetId）的事件；provider 同步的版本事件
      // 統一用下方 design.synced（帶 snapshotId），避免送出 assetId 為空的畸形事件。
      if (!fetched.rendition) {
        results.push({
          externalId,
          designFileId: upserted.fileId,
          snapshotId: null,
          status: upserted.created ? 'created' : 'updated',
          message: '這個檔案沒有可用的預覽，已建立作品但未建版本。',
        })
        continue
      }

      const asset = await storeRenditionAsset(ctx, fetched.rendition.url, `${fetched.title || externalId}.preview`)
      if (!asset.ok) {
        await ctx.db.from('design_files').update({ last_error: asset.error } as never).eq('id', upserted.fileId)
        results.push({ externalId, designFileId: upserted.fileId, snapshotId: null, status: 'error', message: asset.error })
        continue
      }

      const snap = await createSnapshotFromAsset(ctx, upserted.fileId, asset.assetId, fetched.externalVersionId ?? undefined)
      if (!snap.ok) {
        if (snap.reason === 'duplicate') {
          results.push({ externalId, designFileId: upserted.fileId, snapshotId: null, status: 'unchanged', message: '內容沒有變化，沒有建立新版本。' })
        } else {
          const msg = snap.reason === 'asset_not_ready' ? '預覽檔還在處理中。' : '建立版本失敗。'
          await ctx.db.from('design_files').update({ last_error: msg } as never).eq('id', upserted.fileId)
          results.push({ externalId, designFileId: upserted.fileId, snapshotId: null, status: 'error', message: msg })
        }
        continue
      }

      await emitEvent('design.synced', ctx.spaceId, ctx.userId, {
        designFileId: upserted.fileId,
        snapshotId: snap.snapshotId,
        provider,
      }).catch(() => {})

      results.push({
        externalId,
        designFileId: upserted.fileId,
        snapshotId: snap.snapshotId,
        status: upserted.created ? 'created' : 'updated',
      })
    } catch (err) {
      const message =
        err instanceof ProviderApiError ? `provider 錯誤（${err.status}）：${err.message}` : '同步這個檔案時發生問題。'
      if (!(err instanceof ProviderApiError)) console.error('[sync] 未預期錯誤', err)
      results.push({ externalId, designFileId: null, snapshotId: null, status: 'error', message })
    }
  }

  // 記錄本次同步時間到連線
  await ctx.db
    .from('design_connections')
    .update({ last_synced_at: new Date().toISOString() } as never)
    .eq('id', conn.id)

  return results
}
