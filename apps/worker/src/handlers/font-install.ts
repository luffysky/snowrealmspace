import type { Job } from 'pg-boss'
import subsetFont from 'subset-font'
import {
  slicesForScripts,
  budgetForScripts,
  parseUnicodeRange,
  firstScreenBudget,
  type UnicodeSlice,
} from '@snowrealm/theme-engine'
import { createAdminClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'
import { ALL_FONTS, fontBySlug, type FontSource } from '@snowrealm/shared-types'

/**
 * 字體自動安裝（背景 job）。
 *
 * 中文字體子集化 9 字重 × ~48 分片 × 16MB 原檔，在同步 HTTP route 會超過 Cloudflare 100 秒（524）。
 * 移到 worker：無 HTTP timeout、要跑多久跑多久。route 只入列，這裡把它做完並寫進 fonts 表。
 *
 * 邏輯與 apps/web 的 /api/admin/fonts/install 一致（伺服器抓取→子集化→R2→upsert），
 * 只是搬到 worker。冪等：upsert（onConflict slug）+ 物件覆寫，重跑安全。
 */

export type FontInstallPayload = { slug: string }

const KEY_PREFIX = 'public/fonts'
const GITHUB_API = 'https://api.github.com'
const GOOGLE_RAW = 'https://raw.githubusercontent.com/google/fonts/main'

type FileManifest = Record<
  string,
  { subsets: { file: string; unicodeRange: string; bytes: number; critical: boolean }[] }
>

export async function handleFontInstall(jobs: Job<FontInstallPayload>[]): Promise<void> {
  for (const job of jobs) {
    await installOne(job.data.slug).catch((err: unknown) => {
      console.error('[font.install] 失敗', job.data.slug, err)
      throw err
    })
  }
}

async function installOne(slug: string): Promise<void> {
  const entry = fontBySlug(slug)
  if (!entry) throw new Error(`未知字體 ${slug}`)
  if (entry.source.kind === 'manual') throw new Error(`${slug} 無自動來源`)

  const fetched = await fetchSource(entry.source)
  if ('error' in fetched) throw new Error(fetched.error)

  const store = storage()
  const licenseKey = `${KEY_PREFIX}/${entry.slug}/LICENSE.txt`
  await store.put({
    key: licenseKey,
    body: new TextEncoder().encode(fetched.licenseText),
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'public, max-age=31536000, immutable',
  })

  // 邊子集化邊上傳邊釋放 —— 不把整套字重×分片留在記憶體（見 buildAndUpload 註解）
  const built = await buildAndUpload(store, entry.slug, entry.scripts, entry.weights, fetched.files)
  if (!built.withinBudget) throw new Error(`${slug} 首屏超出預算`)

  const admin = createAdminClient()
  const { error } = await admin.from('fonts').upsert(
    {
      family: entry.family,
      slug: entry.slug,
      category: entry.category,
      supported_languages: entry.scripts,
      weights: built.weightList,
      styles: ['normal'],
      preview_text: entry.previewText,
      file_manifest: built.fileManifest,
      subset_strategy: entry.scripts.includes('zh-Hant') ? 'unicode_range' : 'static',
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
  if (error) throw new Error(`寫入 fonts 表失敗：${error.message}`)
  console.log(`[font.install] ✓ ${slug}（${built.weightList.length} 字重）`)
}

// ── 子集化（記憶體內；同 apps/web/lib/fonts/subset.ts）───────────────────
const WEIGHT_TOKENS: [RegExp, number][] = [
  [/thin/i, 100], [/extra-?light|-EL\b/i, 200], [/light|-L\./i, 300], [/regular|normal|-N\./i, 400],
  [/medium|-M\./i, 500], [/semi-?bold|demi-?bold/i, 600], [/bold|-B\./i, 700], [/extra-?bold/i, 800],
  [/black|heavy|-H\./i, 900],
]
function isVariable(name: string): boolean {
  return /\[[^\]]*wght[^\]]*\]/i.test(name)
}
function detectWeight(name: string): number {
  for (const [re, w] of WEIGHT_TOKENS) if (re.test(name)) return w
  return 400
}
async function buildSlice(source: Buffer, slug: string, weight: number, slice: UnicodeSlice, variable: boolean) {
  const text = String.fromCodePoint(...parseUnicodeRange(slice.range))
  const subset = await subsetFont(source, text, {
    targetFormat: 'woff2',
    ...(variable ? { variationAxes: { wght: weight } } : {}),
  })
  if (subset.byteLength < 1024) return null
  return { file: `${slug}-${weight}-${slice.id}.woff2`, unicodeRange: slice.range, bytes: subset.byteLength, critical: slice.critical, body: subset }
}

type SliceMeta = { bytes: number; critical: boolean }

/**
 * 串流式子集化 + 上傳。**這是不吃爆記憶體的關鍵。**
 *
 * 中文一套 9 字重 × ~47 分片 ≈ 423 個 woff2。舊版先全部子集化累積在陣列裡、
 * 再一次上傳，尖峰＝原檔 + 全部 423 個 buffer + harfbuzz wasm 記憶體同時存在，
 * 在記憶體受限的 worker 容器會被 OOM kill（SIGTERM）。
 *
 * 這裡改成每產一片就上傳一片、隨即丟掉 body（只留幾十 bytes 的 metadata），
 * 尖峰的子集 buffer 從 ~423 降到 ~1。每個來源檔處理完也把原始位元組釋放
 * （靜態多檔字體尤其重要）。子集化本身仍是逐一 await，不並行。
 */
async function buildAndUpload(
  store: ReturnType<typeof storage>,
  slug: string,
  scripts: readonly string[],
  weights: readonly number[],
  files: { name: string; body: Uint8Array }[],
) {
  const slices = slicesForScripts(scripts)
  const upright = files.filter((f) => !/italic/i.test(f.name))
  if (upright.length === 0) throw new Error('沒有可用字體檔')

  const fileManifest: FileManifest = {}
  const metaByWeight = new Map<number, SliceMeta[]>()

  for (const file of upright) {
    const variable = isVariable(file.name)
    const targetWeights = variable ? weights : [detectWeight(file.name)]
    const source = Buffer.from(file.body)
    for (const weight of targetWeights) {
      if (!weights.includes(weight)) continue
      if (metaByWeight.has(weight)) continue
      const subsets: FileManifest[string]['subsets'] = []
      const meta: SliceMeta[] = []
      for (const slice of slices) {
        const s = await buildSlice(source, slug, weight, slice, variable)
        if (!s) continue
        const key = `${KEY_PREFIX}/${slug}/${s.file}`
        // 立刻上傳，body 上傳完就沒人引用 → 可被 GC，不累積
        await store.put({ key, body: s.body, contentType: 'font/woff2', cacheControl: 'public, max-age=31536000, immutable' })
        subsets.push({ file: key, unicodeRange: s.unicodeRange, bytes: s.bytes, critical: s.critical })
        meta.push({ bytes: s.bytes, critical: s.critical })
      }
      fileManifest[String(weight)] = { subsets }
      metaByWeight.set(weight, meta)
    }
    // 這個來源檔處理完，釋放原始 TTF 位元組（靜態多檔時省下數十 MB）
    ;(file as { body: Uint8Array | null }).body = null
  }

  if (metaByWeight.size === 0) throw new Error('沒有對應字重的檔案')
  const weightList = [...metaByWeight.keys()].sort((a, b) => a - b)
  const regularMeta = metaByWeight.get(400) ?? metaByWeight.get(weightList[0]!)!
  const limit = budgetForScripts(scripts)
  const budget = firstScreenBudget(regularMeta, limit)
  return { fileManifest, weightList, withinBudget: budget.withinBudget }
}

// ── 從來源抓檔＋授權（同 install route）─────────────────────────────
function ghHeaders(): HeadersInit {
  const token = process.env['GITHUB_TOKEN']
  return { accept: 'application/vnd.github+json', 'user-agent': 'snowrealm-font-installer', ...(token ? { authorization: `Bearer ${token}` } : {}) }
}
async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'user-agent': 'snowrealm-font-installer' } })
  if (!res.ok) throw new Error(`下載失敗（${res.status}）`)
  return new Uint8Array(await res.arrayBuffer())
}
async function fetchSource(
  source: FontSource,
): Promise<{ files: { name: string; body: Uint8Array }[]; licenseText: string } | { error: string }> {
  let downloads: { name: string; url: string }[] = []
  const licenseUrls: string[] = []
  if (source.kind === 'google-fonts') {
    const res = await fetch(`${GITHUB_API}/repos/google/fonts/contents/${source.repoPath}`, { headers: ghHeaders() })
    if (!res.ok) return { error: `列目錄失敗（${res.status}）` }
    const entries = (await res.json()) as { name: string; download_url: string | null }[]
    downloads = entries.filter((e) => /\.(ttf|otf)$/i.test(e.name) && e.download_url).map((e) => ({ name: e.name, url: e.download_url! }))
    licenseUrls.push(`${GOOGLE_RAW}/${source.repoPath}/OFL.txt`, `${GOOGLE_RAW}/${source.repoPath}/LICENSE.txt`)
  } else if (source.kind === 'github-branch') {
    const res = await fetch(`${GITHUB_API}/repos/${source.repo}/contents/${source.path}?ref=${source.branch}`, { headers: ghHeaders() })
    if (!res.ok) return { error: `列目錄失敗（${res.status}）` }
    const entries = (await res.json()) as { name: string; download_url: string | null }[]
    const re = new RegExp(source.filePattern)
    downloads = entries.filter((e) => re.test(e.name) && e.download_url).map((e) => ({ name: e.name, url: e.download_url! }))
    for (const b of ['main', 'master', 'release']) for (const n of ['OFL.txt', 'LICENSE.md', 'LICENSE.txt', 'LICENSE']) licenseUrls.push(`https://raw.githubusercontent.com/${source.repo}/${b}/${n}`)
  } else if (source.kind === 'github-release') {
    const latest = await fetch(`${GITHUB_API}/repos/${source.repo}/releases/latest`, { headers: ghHeaders() })
    const rel = latest.ok
      ? ((await latest.json()) as { assets: { name: string; browser_download_url: string }[] })
      : ((await (await fetch(`${GITHUB_API}/repos/${source.repo}/releases?per_page=5`, { headers: ghHeaders() })).json()) as { assets: { name: string; browser_download_url: string }[] }[])[0]
    const re = new RegExp(source.assetPattern, 'i')
    const assets = (rel?.assets ?? []).filter((a) => re.test(a.name))
    if (assets.some((a) => /\.zip$/i.test(a.name))) return { error: 'zip 打包來源暫不支援自動安裝' }
    downloads = assets.map((a) => ({ name: a.name, url: a.browser_download_url }))
    for (const b of ['main', 'master', 'release']) for (const n of ['OFL.txt', 'LICENSE.txt', 'LICENSE']) licenseUrls.push(`https://raw.githubusercontent.com/${source.repo}/${b}/${n}`)
  } else {
    return { error: '無自動下載來源' }
  }
  if (downloads.length === 0) return { error: '來源找不到字體檔' }
  const files: { name: string; body: Uint8Array }[] = []
  for (const d of downloads) files.push({ name: d.name, body: await download(d.url) })
  let licenseText = ''
  for (const u of licenseUrls) {
    try {
      const r = await fetch(u)
      if (!r.ok) continue
      const t = await r.text()
      if (t.length >= 200) { licenseText = t; break }
    } catch { /* 試下一個 */ }
  }
  if (!licenseText) return { error: '抓不到授權全文' }
  return { files, licenseText }
}
