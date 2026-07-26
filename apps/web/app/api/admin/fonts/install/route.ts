import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'
import { ALL_FONTS, fontBySlug } from '@snowrealm/shared-types'
import { ok, fail, handler } from '@/lib/api/respond'
import { subsetUploadedFont } from '@/lib/fonts/subset'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const KEY_PREFIX = 'public/fonts'
const GITHUB_API = 'https://api.github.com'
const GOOGLE_RAW = 'https://raw.githubusercontent.com/google/fonts/main'

type FileManifest = Record<
  string,
  { subsets: { file: string; unicodeRange: string; bytes: number; critical: boolean }[] }
>

function ghHeaders(): HeadersInit {
  const token = process.env['GITHUB_TOKEN']
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'snowrealm-font-installer',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'user-agent': 'snowrealm-font-installer' } })
  if (!res.ok) throw new Error(`下載失敗（${res.status}）`)
  return new Uint8Array(await res.arrayBuffer())
}

/** 伺服器端從來源抓字體檔＋授權。目前支援 google-fonts / github-branch / github-release(.ttf)。 */
async function fetchSource(
  source: (typeof ALL_FONTS)[number]['source'],
): Promise<{ files: { name: string; body: Uint8Array }[]; licenseText: string } | { error: string }> {
  let downloads: { name: string; url: string }[] = []
  const licenseUrls: string[] = []

  if (source.kind === 'google-fonts') {
    const res = await fetch(`${GITHUB_API}/repos/google/fonts/contents/${source.repoPath}`, { headers: ghHeaders() })
    if (!res.ok) return { error: `列目錄失敗（${res.status}）` }
    const entries = (await res.json()) as { name: string; download_url: string | null }[]
    downloads = entries
      .filter((e) => /\.(ttf|otf)$/i.test(e.name) && e.download_url)
      .map((e) => ({ name: e.name, url: e.download_url! }))
    licenseUrls.push(`${GOOGLE_RAW}/${source.repoPath}/OFL.txt`, `${GOOGLE_RAW}/${source.repoPath}/LICENSE.txt`)
  } else if (source.kind === 'github-branch') {
    const res = await fetch(`${GITHUB_API}/repos/${source.repo}/contents/${source.path}?ref=${source.branch}`, { headers: ghHeaders() })
    if (!res.ok) return { error: `列目錄失敗（${res.status}）` }
    const entries = (await res.json()) as { name: string; download_url: string | null }[]
    const re = new RegExp(source.filePattern)
    downloads = entries
      .filter((e) => re.test(e.name) && e.download_url)
      .map((e) => ({ name: e.name, url: e.download_url! }))
    for (const b of ['main', 'master', 'release'])
      for (const n of ['OFL.txt', 'LICENSE.md', 'LICENSE.txt', 'LICENSE'])
        licenseUrls.push(`https://raw.githubusercontent.com/${source.repo}/${b}/${n}`)
  } else if (source.kind === 'github-release') {
    const latest = await fetch(`${GITHUB_API}/repos/${source.repo}/releases/latest`, { headers: ghHeaders() })
    const rel = latest.ok
      ? ((await latest.json()) as { assets: { name: string; browser_download_url: string }[] })
      : ((await (await fetch(`${GITHUB_API}/repos/${source.repo}/releases?per_page=5`, { headers: ghHeaders() })).json()) as {
          assets: { name: string; browser_download_url: string }[]
        }[])[0]
    const re = new RegExp(source.assetPattern, 'i')
    const assets = (rel?.assets ?? []).filter((a) => re.test(a.name))
    if (assets.some((a) => /\.zip$/i.test(a.name))) {
      return { error: '這套字體的來源是 zip 打包，暫不支援自動安裝，請用 CLI。' }
    }
    downloads = assets.map((a) => ({ name: a.name, url: a.browser_download_url }))
    for (const b of ['main', 'master', 'release'])
      for (const n of ['OFL.txt', 'LICENSE.txt', 'LICENSE'])
        licenseUrls.push(`https://raw.githubusercontent.com/${source.repo}/${b}/${n}`)
  } else {
    return { error: '這套字體沒有穩定的自動下載來源，請用上傳或 CLI。' }
  }

  if (downloads.length === 0) return { error: '來源找不到字體檔。' }

  const files: { name: string; body: Uint8Array }[] = []
  for (const d of downloads) files.push({ name: d.name, body: await download(d.url) })

  let licenseText = ''
  for (const u of licenseUrls) {
    try {
      const r = await fetch(u)
      if (!r.ok) continue
      const t = await r.text()
      if (t.length >= 200) {
        licenseText = t
        break
      }
    } catch {
      /* 試下一個 */
    }
  }
  if (!licenseText) return { error: '抓不到授權全文（OFL 要求隨字體散布）。' }

  return { files, licenseText }
}

/** 伺服器端自動安裝一套內建目錄字體（免瀏覽器上傳，不受 body 大小限制）。 */
export const POST = handler(async (request: Request) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const body = (await request.json().catch(() => null)) as { slug?: string } | null
  const entry = fontBySlug(String(body?.slug ?? ''))
  if (!entry) return fail('VALIDATION_FAILED', '未知的字體代號。')
  if (entry.source.kind === 'manual') {
    return fail('UNPROCESSABLE', '這套字體沒有自動下載來源（例如台北黑體），請用上傳。')
  }

  const fetched = await fetchSource(entry.source)
  if ('error' in fetched) return fail('UNPROCESSABLE', fetched.error)

  let built
  try {
    built = await subsetUploadedFont({ slug: entry.slug, scripts: entry.scripts, weights: entry.weights, files: fetched.files })
  } catch (err) {
    return fail('UNPROCESSABLE', `字體處理失敗：${(err as Error).message}`)
  }
  if (!built.withinBudget) return fail('UNPROCESSABLE', '首屏字體超出預算，這套太重。')

  const store = storage()
  const licenseKey = `${KEY_PREFIX}/${entry.slug}/LICENSE.txt`
  await store.put({
    key: licenseKey,
    body: new TextEncoder().encode(fetched.licenseText),
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'public, max-age=31536000, immutable',
  })

  const fileManifest: FileManifest = {}
  let uploaded = 0
  for (const weight of built.weights) {
    const subsets: FileManifest[string]['subsets'] = []
    for (const slice of weight.slices) {
      const key = `${KEY_PREFIX}/${entry.slug}/${slice.file}`
      await store.put({ key, body: slice.body, contentType: 'font/woff2', cacheControl: 'public, max-age=31536000, immutable' })
      subsets.push({ file: key, unicodeRange: slice.unicodeRange, bytes: slice.bytes, critical: slice.critical })
      uploaded++
    }
    fileManifest[String(weight.weight)] = { subsets }
  }

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

  return ok({ slug: entry.slug, family: entry.family, weights: built.weights.map((w) => w.weight), sliceCount: uploaded })
})
