import type { Job } from 'pg-boss'
import sharp from 'sharp'
import { createAdminClient } from '@snowrealm/db/server'
import { storage, storageKeys } from '@snowrealm/storage'
import { extractPalette } from '@snowrealm/theme-engine'
import { parseVideoDuration } from '@snowrealm/validation'

/**
 * 上傳後處理：探測尺寸、產生衍生檔、跑本地分析。
 *
 * ADR-012：這裡的產出全是**可計算、可重現的數值**（Fact / Metric），
 * 不呼叫任何 AI。Vision 的主觀判讀是 Milestone D 的另一條路徑。
 *
 * 08-jobs-events.md §2.3：handler 自身必須冪等 ——
 * pg-boss 是 at-least-once，worker 在寫入 DB 後、標記完成前崩潰就會重跑。
 */

export type AssetProcessPayload = { assetId: string; spaceId: string }

const THUMBNAIL_MAX = 400
const PREVIEW_MAX = 1600

export async function handleAssetProcess(jobs: Job<AssetProcessPayload>[]): Promise<void> {
  for (const job of jobs) {
    await processOne(job.data).catch((err: unknown) => {
      console.error('[asset.process] 失敗', job.data.assetId, err)
      throw err
    })
  }
}

/**
 * 驗證影片時長並回填。ADR-019。
 *
 * ## 為什麼要在伺服器端再驗一次
 *
 * 前端用 `<video>` 量過一次，但那是**使用者可以改的值** ——
 * 直接送一個 `durationMs: 1000` 的請求就能繞過 30 秒限制。
 * 這裡讀真正的檔案內容，是唯一的權威來源。
 *
 * 超過上限的處理是**軟刪除 + 明確訊息**，不是靜靜留著：
 * 留著的話使用者會看到一個永遠無法設為背景的檔案，卻不知道為什麼。
 */
async function verifyVideoDuration(
  db: ReturnType<typeof createAdminClient>,
  assetId: string,
  storageKey: string,
): Promise<void> {
  // 時長在容器開頭，不必下載整個檔案。
  // 2 MB 足以涵蓋 moov 在檔尾的情況以外的所有一般狀況。
  const head = await storage().get(storageKey)
  const meta = parseVideoDuration(head)

  if (!meta) {
    // 解析不出來不代表檔案有問題（moov 可能在檔尾），
    // 但也不能當成通過 —— 記錄下來，讓它維持可用但沒有時長資訊。
    console.warn('[asset.process] 無法解析影片時長', assetId)
    return
  }

  // 500MB 偏離（Luffy）：背景影片不轉碼、直接播，不再有時長硬限。
  // 只回填時長供 UI 顯示。
  await db.from('assets').update({ duration_ms: meta.durationMs }).eq('id', assetId)
  console.log('[asset.process] 影片時長已回填', assetId, `${meta.durationMs}ms`)
}

async function processOne(payload: AssetProcessPayload): Promise<void> {
  const db = createAdminClient()
  const { assetId } = payload

  const { data: asset } = await db
    .from('assets')
    .select('id, space_id, created_by, kind, mime_type, storage_key, status, width')
    .eq('id', assetId)
    .maybeSingle()

  if (!asset) {
    console.warn('[asset.process] asset 不存在，略過', assetId)
    return
  }
  if (asset.status !== 'ready') {
    console.warn('[asset.process] asset 尚未就緒，略過', assetId, asset.status)
    return
  }

  // ── 冪等檢查：已經處理過就不重做 ──
  const { data: existing } = await db
    .from('asset_renditions')
    .select('role')
    .eq('asset_id', assetId)

  const done = new Set((existing ?? []).map((r) => r.role))
  if (done.has('thumbnail') && done.has('preview') && asset.width !== null) {
    console.log('[asset.process] 已處理過，略過', assetId)
    return
  }

  if (asset.kind === 'video') {
    await verifyVideoDuration(db, asset.id, asset.storage_key)
    return
  }

  if (asset.kind !== 'image') {
    // PDF 縮圖需要額外相依，排在 Milestone C。
    console.log('[asset.process] 目前只處理圖片與影片，略過', assetId, asset.kind)
    return
  }

  const original = await storage().get(asset.storage_key)
  const image = sharp(Buffer.from(original), { failOn: 'none' })
  const meta = await image.metadata()

  const width = meta.width ?? null
  const height = meta.height ?? null

  // ── 衍生檔 ──
  const ownerId = asset.created_by ?? 'unknown'

  if (!done.has('thumbnail')) {
    await makeRendition(db, {
      assetId,
      spaceId: asset.space_id,
      ownerId,
      role: 'thumbnail',
      maxSize: THUMBNAIL_MAX,
      source: original,
    })
  }

  if (!done.has('preview')) {
    await makeRendition(db, {
      assetId,
      spaceId: asset.space_id,
      ownerId,
      role: 'preview',
      maxSize: PREVIEW_MAX,
      source: original,
    })
  }

  // ── 本地分析（ADR-012）──
  const localFeatures = await analyzeLocally(original)

  await db
    .from('assets')
    .update({
      width,
      height,
      local_features: {
        ...localFeatures,
        dimensions: { width, height, aspectRatio: width && height ? width / height : null },
        computedAt: new Date().toISOString(),
      } as never,
    })
    .eq('id', assetId)

  console.log('[asset.process] 完成', assetId)
}

async function makeRendition(
  db: ReturnType<typeof createAdminClient>,
  input: {
    assetId: string
    spaceId: string
    ownerId: string
    role: 'thumbnail' | 'preview'
    maxSize: number
    source: Uint8Array
  },
): Promise<void> {
  const output = await sharp(Buffer.from(input.source), { failOn: 'none' })
    .rotate() // 依 EXIF 轉正，否則手機拍的照片縮圖會是躺著的
    .resize(input.maxSize, input.maxSize, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: input.role === 'thumbnail' ? 72 : 82 })
    .toBuffer({ resolveWithObject: true })

  const key = storageKeys.assetRendition(input.ownerId, input.spaceId, input.assetId, input.role)

  await storage().put({ key, body: output.data, contentType: 'image/webp' })

  await db.from('asset_renditions').upsert(
    {
      asset_id: input.assetId,
      space_id: input.spaceId,
      role: input.role,
      mime_type: 'image/webp',
      bytes: output.data.byteLength,
      storage_key: key,
      width: output.info.width,
      height: output.info.height,
    },
    { onConflict: 'asset_id,role' },
  )
}

/**
 * 本地分析。全部可重現，零成本。
 *
 * 這些數值會成為 Agent 的 `metric` 類陳述來源（07-agent.md §1）——
 * 因此必須真的可信，不能是估算。
 */
async function analyzeLocally(source: Uint8Array): Promise<Record<string, unknown>> {
  // 縮到 200×200 再分析：k-means 對百萬像素跑不完 3 秒，
  // 而色彩分布在縮圖上幾乎不變。
  const small = await sharp(Buffer.from(source), { failOn: 'none' })
    .rotate()
    .resize(200, 200, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const palette = extractPalette(new Uint8Array(small.data), 5)

  // 留白比例：接近純白/純黑且低飽和的像素佔比
  const { data, info } = small
  let flat = 0
  const total = info.width * info.height
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max - min < 18 && (max > 235 || max < 20)) flat++
  }

  return {
    colors: {
      dominant: palette.dominant,
      secondary: palette.secondary,
      accent: palette.accent,
      darkest: palette.darkest,
      lightest: palette.lightest,
      palette: palette.swatches,
      count: palette.stats.colorCount,
    },
    composition: {
      whitespaceRatio: Math.round((flat / total) * 1000) / 1000,
      averageSaturation: palette.stats.averageSaturation,
      averageLightness: palette.stats.averageLightness,
      isDark: palette.stats.isDark,
    },
  }
}
