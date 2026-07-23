import type { Job } from 'pg-boss'
import sharp from 'sharp'
import { createAdminClient } from '@snowrealm/db/server'
import { storage, storageKeys } from '@snowrealm/storage'
import { extractPalette } from '@snowrealm/theme-engine'

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

  if (asset.kind !== 'image') {
    // 影片的 poster frame 需要 ffmpeg，排在 Milestone B 後段；
    // PDF 縮圖需要額外相依。這兩類先只回填「已處理」的標記。
    console.log('[asset.process] 目前只處理圖片，略過', assetId, asset.kind)
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
