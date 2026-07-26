import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'
import { ALL_FONTS, fontBySlug, type FontSource } from '@snowrealm/shared-types'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { subsetUploadedFont } from '@/lib/fonts/subset'

// CJK 子集化很耗 CPU（單套字體數十片 × 數字重）。Zeabur 是常駐容器不是 serverless，
// 沒有硬性 10s 上限，但仍把上限拉高、明確走 node runtime（subset-font 用 harfbuzz wasm）。
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const KEY_PREFIX = 'public/fonts'

type FileManifest = Record<
  string,
  { subsets: { file: string; unicodeRange: string; bytes: number; critical: boolean }[] }
>

/** 首屏成本（400 字重的 critical 分片總量），給後台誠實顯示「這套要多載多少」。 */
function firstScreen400(manifest: unknown): number {
  const m = (manifest ?? {}) as FileManifest
  return (m['400']?.subsets ?? [])
    .filter((s) => s.critical)
    .reduce((n, s) => n + (s.bytes ?? 0), 0)
}

/** 目錄字體的取得提示（給後台顯示「這套從哪來」）。 */
function sourceHint(source: FontSource): string {
  switch (source.kind) {
    case 'manual':
      return '需人工下載（見 docs/fonts/README.md）'
    case 'google-fonts':
      return `Google Fonts：${source.repoPath}`
    case 'github-release':
      return `GitHub Release：${source.repo}`
    case 'github-branch':
      return `GitHub：${source.repo}@${source.branch}`
    case 'direct':
      return source.url
  }
}

/** 站台字體清單（含停用）＋ 內建目錄安裝狀態。站台管理員維護。 */
export const GET = handler(async () => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('fonts')
    .select('id, slug, family, category, supported_languages, weights, enabled, subset_strategy, file_manifest, license_name, license_url, sort_order')
    .order('sort_order', { ascending: true })
  if (error) return fail('INTERNAL', '無法載入字體。')

  const installed = (data ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    family: f.family,
    category: f.category,
    scripts: f.supported_languages,
    weights: f.weights,
    enabled: f.enabled,
    firstScreenBytes: firstScreen400(f.file_manifest),
    license: { name: f.license_name, url: f.license_url },
  }))
  const installedSlugs = new Set(installed.map((f) => f.slug))

  const catalogue = ALL_FONTS.map((f) => ({
    slug: f.slug,
    family: f.family,
    displayName: f.displayName,
    category: f.category,
    scripts: f.scripts,
    weights: f.weights,
    manual: f.source.kind === 'manual',
    license: f.license,
    licenseUrl: f.licenseUrl,
    installed: installedSlugs.has(f.slug),
    sourceHint: sourceHint(f.source),
  }))

  return ok({ installed, catalogue })
})

/**
 * 安裝一套內建目錄字體：上傳原始 ttf/otf（＋授權全文）→ 子集化 → 上傳 R2 → 寫入 fonts 表。
 *
 * 只接受 `ALL_FONTS` 目錄裡的 slug —— metadata（scripts/weights/授權）全部來自目錄，
 * 不接受任意使用者字體（ADR-016：無法驗證授權範圍）。等於把「人工下載＋跑 CLI」搬到後台。
 */
export const POST = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  // formData() 失敗多半是 body 太大被代理擋掉（字體檔很大），不是真的沒帶表單。
  const form = await request.formData().catch(() => null)
  if (!form) {
    return fail(
      'UNPROCESSABLE',
      '無法讀取上傳內容——通常是字體檔太大被伺服器/代理擋下。思源等 13 套可用 CLI（scripts/download-fonts.ts）安裝；台北黑體檔案較大時，單一字重分次上傳或改用 CLI。',
    )
  }

  const slug = String(form.get('slug') ?? '').trim()
  const entry = fontBySlug(slug)
  if (!entry) return fail('VALIDATION_FAILED', '未知的字體代號（只接受內建目錄中的 OFL 字體）。')

  const fontFiles = form.getAll('fonts').filter((f): f is File => f instanceof File && f.size > 0)
  if (fontFiles.length === 0) return fail('VALIDATION_FAILED', '請至少上傳一個字體檔（.ttf / .otf）。')
  for (const f of fontFiles) {
    if (!/\.(ttf|otf)$/i.test(f.name)) {
      return fail('UNSUPPORTED_MEDIA_TYPE', `不支援的檔案：${f.name}（只接受 .ttf / .otf）。`)
    }
  }

  // OFL 硬性要求：授權全文必須隨字體散布。缺了不是警告是拒絕（同 build-fonts）。
  const licenseFile = form.get('license')
  if (!(licenseFile instanceof File) || licenseFile.size === 0) {
    return fail('VALIDATION_FAILED', 'OFL 要求授權全文隨字體散布，請一併上傳授權檔（OFL.txt / LICENSE）。')
  }
  const licenseText = await licenseFile.text()
  if (licenseText.trim().length < 200) {
    return fail('VALIDATION_FAILED', '授權檔內容過短，看起來不是完整的授權全文。')
  }

  // 子集化（記憶體內）
  const files = await Promise.all(
    fontFiles.map(async (f) => ({ name: f.name, body: new Uint8Array(await f.arrayBuffer()) })),
  )
  let built
  try {
    built = await subsetUploadedFont({
      slug: entry.slug,
      scripts: entry.scripts,
      weights: entry.weights,
      files,
    })
  } catch (err) {
    return fail('UNPROCESSABLE', `字體處理失敗：${(err as Error).message}`)
  }
  if (!built.withinBudget) {
    return fail(
      'UNPROCESSABLE',
      `首屏字體 ${kb(built.firstScreenBytes)} 超出 ${kb(built.budgetLimit)} 預算 ${kb(built.overBy)}，這套太重無法用於首屏。`,
    )
  }

  // 上傳 R2：先授權後字體（順序反過來中途失敗會留下無授權的字體檔）。
  const store = storage()
  const licenseKey = `${KEY_PREFIX}/${entry.slug}/LICENSE.txt`
  await store.put({
    key: licenseKey,
    body: new TextEncoder().encode(licenseText),
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'public, max-age=31536000, immutable',
  })

  const fileManifest: FileManifest = {}
  let uploadedSlices = 0
  for (const weight of built.weights) {
    const subsets: FileManifest[string]['subsets'] = []
    for (const slice of weight.slices) {
      const key = `${KEY_PREFIX}/${entry.slug}/${slice.file}`
      await store.put({
        key,
        body: slice.body,
        contentType: 'font/woff2',
        // 檔名含 slug + 字重 + 分片 id，內容變檔名變 → 可安全 immutable 一年。
        cacheControl: 'public, max-age=31536000, immutable',
      })
      subsets.push({ file: key, unicodeRange: slice.unicodeRange, bytes: slice.bytes, critical: slice.critical })
      uploadedSlices++
    }
    fileManifest[String(weight.weight)] = { subsets }
  }

  // 寫入 fonts 表（service role：字體是全域公開參考資料，非某 space 的內容）。
  const admin = createAdminClient()
  const { error } = await admin.from('fonts').upsert(
    {
      family: entry.family,
      slug: entry.slug,
      category: entry.category,
      supported_languages: entry.scripts,
      weights: built.weights.map((w) => w.weight),
      styles: ['normal'],
      preview_text: entry.previewText,
      file_manifest: fileManifest,
      subset_strategy: built.subsetStrategy,
      license_name: entry.license,
      license_url: entry.licenseUrl,
      license_file_key: licenseKey,
      attribution_required: false,
      fallback_stack: entry.fallbackStack,
      enabled: true,
      sort_order: ALL_FONTS.findIndex((f) => f.slug === entry.slug),
    } as never,
    { onConflict: 'slug' },
  )
  if (error) return fail('INTERNAL', '寫入字體資料失敗。')

  return ok({
    slug: entry.slug,
    family: entry.family,
    weights: built.weights.map((w) => w.weight),
    sliceCount: uploadedSlices,
    firstScreenBytes: built.firstScreenBytes,
    totalBytes: built.totalBytes,
  })
})

const patchSchema = z.object({ enabled: z.boolean() }).strict()

/** 切換字體啟用（?slug=）。停用的字體不會出現在前台字體選單。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) return fail('VALIDATION_FAILED', '缺少字體 slug。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('fonts')
    .update({ enabled: parsed.data.enabled } as never)
    .eq('slug', slug)
    .select('slug')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這個字體。')
  return ok({ slug, enabled: parsed.data.enabled })
})

/** 移除字體（?slug=）：先刪 R2 分片與授權檔，再刪 DB 列（font_pairs 依 FK cascade）。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) return fail('VALIDATION_FAILED', '缺少字體 slug。')

  const admin = createAdminClient()
  const { data: row, error: readErr } = await admin
    .from('fonts')
    .select('slug, file_manifest, license_file_key')
    .eq('slug', slug)
    .maybeSingle<{ slug: string; file_manifest: FileManifest; license_file_key: string | null }>()
  if (readErr) return fail('INTERNAL', '讀取字體失敗。')
  if (!row) return fail('NOT_FOUND', '找不到這個字體。')

  // 先清 R2（best-effort：物件刪除是冪等的，失敗也不擋 DB 刪除，避免留下孤兒列）。
  const keys = Object.values(row.file_manifest ?? {}).flatMap((w) => w.subsets.map((s) => s.file))
  if (row.license_file_key) keys.push(row.license_file_key)
  const store = storage()
  await Promise.all(keys.map((k) => store.delete(k).catch(() => {})))

  const { error: delErr } = await admin.from('fonts').delete().eq('slug', slug)
  if (delErr) return fail('INTERNAL', '刪除字體失敗。')
  return ok({ slug })
})

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}
