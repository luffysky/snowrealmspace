import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { ALL_FONTS, type FontEntry } from '@snowrealm/shared-types'

/**
 * 下載字體原始檔到 assets/fonts/<slug>/。
 *
 * 只抓授權明確允許重新散布的來源（全部是 OFL 1.1 / Apache 2.0）。
 * 沒有穩定下載路徑的（kind: 'manual'）會列出來要人工處理 ——
 * **不會**去猜一個網址然後抓到錯的東西。
 *
 * 用法：
 *   pnpm tsx scripts/download-fonts.ts            # 抓全部能自動抓的
 *   pnpm tsx scripts/download-fonts.ts noto-sans-tc
 *
 * ⚠️ assets/fonts/ 在 .gitignore 裡。繁中字體單檔 6–9 MB，
 * commit 進 git 之後永遠移不掉。
 */

const ROOT = join(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'assets', 'fonts')

const GOOGLE_FONTS_RAW = 'https://raw.githubusercontent.com/google/fonts/main'
const GITHUB_API = 'https://api.github.com'

type Outcome =
  | { slug: string; status: 'downloaded'; files: number; bytes: number }
  | { slug: string; status: 'cached'; files: number }
  | { slug: string; status: 'manual'; instructions: string }
  | { slug: string; status: 'failed'; reason: string }

async function main() {
  const only = process.argv.slice(2)
  const targets = only.length > 0 ? ALL_FONTS.filter((f) => only.includes(f.slug)) : ALL_FONTS

  if (targets.length === 0) {
    console.error(`找不到字體：${only.join(', ')}`)
    console.error(`可用的：${ALL_FONTS.map((f) => f.slug).join(', ')}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  const outcomes: Outcome[] = []
  for (const font of targets) {
    outcomes.push(await fetchFont(font))
  }

  report(outcomes)

  // manual 不算失敗 —— 它是「需要人做」，不是「壞了」
  const failed = outcomes.filter((o) => o.status === 'failed')
  if (failed.length > 0) process.exit(1)
}

async function fetchFont(font: FontEntry): Promise<Outcome> {
  const dir = join(OUT_DIR, font.slug)

  if (existsSync(dir)) {
    const files = (await readdir(dir)).filter((f) => /\.(ttf|otf|woff2)$/i.test(f))
    if (files.length > 0) return { slug: font.slug, status: 'cached', files: files.length }
  }

  if (font.source.kind === 'manual') {
    return { slug: font.slug, status: 'manual', instructions: font.source.instructions }
  }

  await mkdir(dir, { recursive: true })

  try {
    const downloads =
      font.source.kind === 'google-fonts'
        ? await googleFontsFiles(font.source.repoPath)
        : font.source.kind === 'github-release'
          ? await githubReleaseFiles(font.source.repo, font.source.assetPattern)
          : font.source.kind === 'github-branch'
            ? await githubBranchFiles(
                font.source.repo,
                font.source.branch,
                font.source.path,
                font.source.filePattern,
              )
            : [{ name: fileNameFromUrl(font.source.url), url: font.source.url }]

    if (downloads.length === 0) {
      return { slug: font.slug, status: 'failed', reason: '來源沒有符合條件的檔案' }
    }

    let bytes = 0
    let written = 0
    for (const d of downloads) {
      const buf = await download(d.url)
      bytes += buf.byteLength

      if (d.name.toLowerCase().endsWith('.zip')) {
        written += extractFonts(buf, dir)
      } else {
        await writeFile(join(dir, d.name), buf)
        written += 1
      }
    }

    if (written === 0) {
      return { slug: font.slug, status: 'failed', reason: 'zip 裡沒有字體檔' }
    }

    // OFL 要求授權全文必須隨字體散布。抓不到就是不能用。
    const licenseOk = await fetchLicense(font, dir)
    if (!licenseOk) {
      return {
        slug: font.slug,
        status: 'failed',
        reason: `抓不到授權檔 ${font.licenseFile}。OFL 要求授權全文必須隨字體散布，沒有它就不能用。`,
      }
    }

    return { slug: font.slug, status: 'downloaded', files: written, bytes }
  } catch (err) {
    return { slug: font.slug, status: 'failed', reason: (err as Error).message }
  }
}

/** Google Fonts 的 repo 結構固定：ofl/<family>/*.ttf */
async function googleFontsFiles(repoPath: string): Promise<{ name: string; url: string }[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/google/fonts/contents/${repoPath}`,
    githubHeaders(),
  )
  if (!res.ok) throw new Error(`Google Fonts 列目錄失敗（${res.status}）：${repoPath}`)

  const entries = (await res.json()) as { name: string; download_url: string | null }[]
  return entries
    .filter((e) => /\.(ttf|otf)$/i.test(e.name) && e.download_url)
    .map((e) => ({ name: e.name, url: e.download_url! }))
}

type Release = { tag_name: string; assets: { name: string; browser_download_url: string }[] }

async function githubReleaseFiles(
  repo: string,
  assetPattern: string,
): Promise<{ name: string; url: string }[]> {
  let release: Release | null = null

  const latest = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, githubHeaders())
  if (latest.ok) {
    release = (await latest.json()) as Release
  } else {
    // /releases/latest 只認正式版。有些專案（例如朱雀仿宋）所有版本
    // 都標為 pre-release，那個端點會 404 —— 退回列出全部取第一筆。
    const all = await fetch(`${GITHUB_API}/repos/${repo}/releases?per_page=5`, githubHeaders())
    if (!all.ok) throw new Error(`GitHub release 查詢失敗（${all.status}）：${repo}`)
    const list = (await all.json()) as Release[]
    release = list[0] ?? null
  }

  if (!release) throw new Error(`${repo} 沒有任何 release`)

  const re = new RegExp(assetPattern, 'i')
  return release.assets
    .filter((a) => re.test(a.name))
    .map((a) => ({ name: a.name, url: a.browser_download_url }))
}

/**
 * 抓 repo 分支中的檔案。
 * 昭源字體把建置產物放在 `release` 分支，release 頁面本身沒有資產。
 */
async function githubBranchFiles(
  repo: string,
  branch: string,
  path: string,
  filePattern: string,
): Promise<{ name: string; url: string }[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${path}?ref=${branch}`,
    githubHeaders(),
  )
  if (!res.ok) throw new Error(`列目錄失敗（${res.status}）：${repo}/${path}@${branch}`)

  const entries = (await res.json()) as { name: string; download_url: string | null }[]
  const re = new RegExp(filePattern)
  return entries
    .filter((e) => re.test(e.name) && e.download_url)
    .map((e) => ({ name: e.name, url: e.download_url! }))
}

/** 從 zip 取出字體檔與授權檔，攤平放進目錄（忽略 zip 內的層級）。 */
function extractFonts(buf: Buffer, dir: string): number {
  const zip = new AdmZip(buf)
  let count = 0

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = entry.entryName.split('/').pop() ?? ''

    if (/\.(ttf|otf|woff2)$/i.test(name)) {
      zip.extractEntryTo(entry, dir, false, true)
      count++
    } else if (/^(OFL|LICENSE)(\.txt|\.md)?$/i.test(name)) {
      zip.extractEntryTo(entry, dir, false, true)
    }
  }
  return count
}

/**
 * 抓授權檔。試幾個常見位置 ——
 * repo 之間放的地方不一致（OFL.txt / LICENSE / LICENSE.md，根目錄或子目錄）。
 */
async function fetchLicense(font: FontEntry, dir: string): Promise<boolean> {
  const candidates: string[] = []

  if (font.source.kind === 'google-fonts') {
    candidates.push(`${GOOGLE_FONTS_RAW}/${font.source.repoPath}/OFL.txt`)
    candidates.push(`${GOOGLE_FONTS_RAW}/${font.source.repoPath}/LICENSE.txt`)
  } else if (font.source.kind === 'github-release' || font.source.kind === 'github-branch') {
    for (const branch of ['main', 'master', 'release']) {
      for (const name of [font.licenseFile, 'OFL.txt', 'LICENSE.txt', 'LICENSE', 'LICENSE.md']) {
        candidates.push(
          `https://raw.githubusercontent.com/${font.source.repo}/${branch}/${name}`,
        )
      }
    }
  }

  for (const url of candidates) {
    const res = await fetch(url)
    if (!res.ok) continue
    const text = await res.text()
    // 內容檢查：抓到 404 頁面或空檔都不算數
    if (text.length < 200) continue
    await writeFile(join(dir, 'LICENSE.txt'), text, 'utf8')
    return true
  }
  return false
}

function githubHeaders(): RequestInit {
  const token = process.env['GITHUB_TOKEN']
  return {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'snowrealm-font-downloader',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'user-agent': 'snowrealm-font-downloader' } })
  if (!res.ok) throw new Error(`下載失敗（${res.status}）：${url}`)
  return Buffer.from(await res.arrayBuffer())
}

function fileNameFromUrl(url: string): string {
  return new URL(url).pathname.split('/').pop() ?? 'font.ttf'
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function report(outcomes: Outcome[]): void {
  console.log('')
  for (const o of outcomes) {
    switch (o.status) {
      case 'downloaded':
        console.log(`✓ ${o.slug} — ${o.files} 個檔案，${mb(o.bytes)}`)
        break
      case 'cached':
        console.log(`· ${o.slug} — 已存在（${o.files} 個檔案），略過`)
        break
      case 'manual':
        console.log(`⚠ ${o.slug} — 需要人工下載`)
        console.log(`    ${o.instructions}`)
        break
      case 'failed':
        console.error(`✗ ${o.slug} — ${o.reason}`)
        break
    }
  }

  const manual = outcomes.filter((o) => o.status === 'manual')
  if (manual.length > 0) {
    console.log('')
    console.log(`${manual.length} 套需要人工下載，放進 assets/fonts/<slug>/ 即可。`)
    console.log('授權全文（OFL.txt / LICENSE）也要一併放進去 —— 那是 OFL 的要求，不是可選的。')
  }
  console.log('')
}

// 給測試用，避免 import 就執行
if (process.argv[1]?.includes('download-fonts')) {
  await main()
}

export { fetchFont, googleFontsFiles, githubReleaseFiles, githubBranchFiles }
export type { Outcome }
