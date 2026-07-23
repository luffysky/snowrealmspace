import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import subsetFont from 'subset-font'
import { ALL_FONTS, FONT_PAIRINGS, type FontEntry } from '@snowrealm/shared-types'
import {
  slicesForScripts,
  budgetForScripts,
  pairingFirstScreenBytes,
  FIRST_SCREEN_BUDGET,
  parseUnicodeRange,
  firstScreenBudget,
  type UnicodeSlice,
} from '@snowrealm/theme-engine'

/**
 * 把 assets/fonts/ 的原始檔切成 unicode-range 分片（woff2），
 * 輸出到 assets/fonts-build/，並產生 file_manifest 供 seed 使用。
 *
 * 用法：
 *   pnpm tsx scripts/build-fonts.ts             # 全部
 *   pnpm tsx scripts/build-fonts.ts noto-sans-tc
 *
 * ## 為什麼子集產物不沿用原字體名稱
 *
 * OFL 把子集化視為衍生作品。有 Reserved Font Name 的字體，
 * 衍生版本不可宣稱自己是原字體。我們統一用 slug 當內部 family，
 * 並保留原始 LICENSE 一起上傳。
 *
 * ## 為什麼在建置時就檢查預算
 *
 * 首屏 100 KB 是 ADR-016 的硬性要求。放到執行期才發現超標，
 * 使用者已經在等那 3 MB 了。這裡超標直接讓建置失敗。
 */

const ROOT = join(import.meta.dirname, '..')
const SRC_DIR = join(ROOT, 'assets', 'fonts')
const OUT_DIR = join(ROOT, 'assets', 'fonts-build')

/** 檔名裡的字重標記 → 數值。各家命名不一致，全部列出來比猜可靠。 */
const WEIGHT_TOKENS: [RegExp, number][] = [
  [/thin/i, 100],
  [/extra-?light|-EL\b/i, 200],
  [/light|-L\./i, 300],
  [/regular|normal|-N\./i, 400],
  [/medium|-M\./i, 500],
  [/semi-?bold|demi-?bold/i, 600],
  [/bold|-B\./i, 700],
  [/extra-?bold/i, 800],
  [/black|heavy|-H\./i, 900],
]

type SliceOutput = {
  sliceId: string
  file: string
  unicodeRange: string
  bytes: number
  critical: boolean
}

type WeightOutput = { weight: number; source: string; slices: SliceOutput[] }

type FontManifest = {
  slug: string
  family: string
  licenseFile: string
  subsetStrategy: 'unicode_range' | 'static'
  weights: WeightOutput[]
  totalBytes: number
  firstScreenBytes: number
}

/**
 * --report：印出每一片的實際大小但不因超出預算而失敗。
 * 用來訂預算，而不是用來繞過它 —— 沒有這個模式就只能猜。
 */
const REPORT_ONLY = process.argv.includes('--report')

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const targets = only.length > 0 ? ALL_FONTS.filter((f) => only.includes(f.slug)) : ALL_FONTS

  await mkdir(OUT_DIR, { recursive: true })

  const manifests: FontManifest[] = []
  const skipped: string[] = []
  const failures: string[] = []

  for (const font of targets) {
    const dir = join(SRC_DIR, font.slug)
    if (!existsSync(dir)) {
      skipped.push(`${font.slug}（原始檔不存在，先跑 download-fonts）`)
      continue
    }

    // OFL 要求授權全文隨字體散布。缺了就不能上傳，不是警告是中止。
    if (!existsSync(join(dir, 'LICENSE.txt'))) {
      failures.push(`${font.slug}：缺 LICENSE.txt。OFL 要求授權全文必須隨字體散布。`)
      continue
    }

    try {
      manifests.push(await buildFont(font, dir))
    } catch (err) {
      failures.push(`${font.slug}：${(err as Error).message}`)
    }
  }

  await writeFile(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifests, null, 2),
    'utf8',
  )

  report(manifests, skipped, failures)
  if (failures.length > 0) process.exit(1)
}

async function buildFont(font: FontEntry, dir: string): Promise<FontManifest> {
  const slices = slicesForScripts(font.scripts)
  const files = (await readdir(dir)).filter((f) => /\.(ttf|otf)$/i.test(f))

  if (files.length === 0) throw new Error('目錄裡沒有 ttf/otf')

  const outDir = join(OUT_DIR, font.slug)
  await mkdir(outDir, { recursive: true })

  // 授權檔一起複製過去 —— 上傳到 R2 時要跟字體放在一起
  await writeFile(join(outDir, 'LICENSE.txt'), await readFile(join(dir, 'LICENSE.txt')))

  const weights: WeightOutput[] = []

  // 斜體不做。中文沒有真正的斜體（機械傾斜會讓字形壞掉），
  // 拉丁斜體目前也沒有任何 UI 用得到 —— 做了就是浪費頻寬與建置時間。
  const upright = files.filter((f) => !/italic/i.test(f))

  for (const file of upright) {
    const source = await readFile(join(dir, file))

    // Google Fonts 一律提供可變字體（檔名有 `[wght]`）。
    // 直接子集化會保留整個變化空間 —— 實測 Inter 的基本拉丁因此
    // 從 ~30 KB 膨脹到 104 KB。必須先固定成單一字重實例。
    const variable = isVariable(file)
    const targetWeights = variable ? font.weights : [detectWeight(file)]

    for (const weight of targetWeights) {
      if (!font.weights.includes(weight)) continue
      if (weights.some((w) => w.weight === weight)) continue

      const sliceOutputs: SliceOutput[] = []
      for (const slice of slices) {
        const out = await buildSlice(source, font, weight, slice, outDir, variable)
        // 這個字體完全沒有這段碼位的字 → 子集是空的，不要產生檔案，
        // 也不要寫進 manifest（否則會有一條 404 的 @font-face）
        if (out) sliceOutputs.push(out)
      }
      weights.push({ weight, source: file, slices: sliceOutputs })
    }
  }

  if (weights.length === 0) {
    throw new Error(`沒有符合宣告字重 [${font.weights.join(', ')}] 的檔案`)
  }

  weights.sort((a, b) => a.weight - b.weight)

  const allSlices = weights.flatMap((w) => w.slices)
  const totalBytes = allSlices.reduce((n, s) => n + s.bytes, 0)

  // 預算只算 400 字重的 critical 分片 ——
  // 首屏不會同時用到所有字重，把全部字重加總會得到一個沒有意義的大數字。
  const regular = weights.find((w) => w.weight === 400) ?? weights[0]!
  const limit = budgetForScripts(font.scripts)
  const budget = firstScreenBudget(
    regular.slices.map((s) => ({ bytes: s.bytes, critical: s.critical })),
    limit,
  )

  if (!budget.withinBudget && !REPORT_ONLY) {
    throw new Error(
      `首屏字體 ${kb(budget.totalBytes)} 超出 ${kb(limit)} 預算 ${kb(budget.overBy)}。` +
        `減少 CJK_CORE_CHARS 的字數，或把 critical 的分片再切細。`,
    )
  }

  return {
    slug: font.slug,
    family: font.family,
    licenseFile: 'LICENSE.txt',
    subsetStrategy: font.scripts.includes('zh-Hant') ? 'unicode_range' : 'static',
    weights,
    totalBytes,
    firstScreenBytes: budget.totalBytes,
  }
}

async function buildSlice(
  source: Buffer,
  font: FontEntry,
  weight: number,
  slice: UnicodeSlice,
  outDir: string,
  variable: boolean,
): Promise<SliceOutput | null> {
  const text = String.fromCodePoint(...parseUnicodeRange(slice.range))

  const subset = await subsetFont(source, text, {
    targetFormat: 'woff2',
    // 固定 wght 軸 → 產出單一字重的靜態實例，變化空間被丟掉。
    // 這是可變字體必須做的一步，否則每一片都會帶著全部字重的資料。
    ...(variable ? { variationAxes: { wght: weight } } : {}),
  })

  // harfbuzz 對完全沒命中的子集仍會產出一個最小的合法檔（純 header）。
  // 用大小門檻判斷「這片其實沒有字」—— 1 KB 以下不可能有可見字形。
  if (subset.byteLength < 1024) return null

  const file = `${font.slug}-${weight}-${slice.id}.woff2`
  await writeFile(join(outDir, file), subset)

  return {
    sliceId: slice.id,
    file,
    unicodeRange: slice.range,
    bytes: subset.byteLength,
    critical: slice.critical,
  }
}

/** 可變字體的檔名帶有軸名，例如 `Inter[opsz,wght].ttf`。 */
function isVariable(filename: string): boolean {
  return /\[[^\]]*wght[^\]]*\]/i.test(filename)
}

function detectWeight(filename: string): number {
  for (const [pattern, weight] of WEIGHT_TOKENS) {
    if (pattern.test(filename)) return weight
  }
  return 400
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function report(manifests: FontManifest[], skipped: string[], failures: string[]): void {
  console.log('')
  for (const m of manifests) {
    const sliceCount = m.weights.reduce((n, w) => n + w.slices.length, 0)
    console.log(
      `✓ ${m.slug} — ${m.weights.length} 字重、${sliceCount} 片、` +
        `共 ${mb(m.totalBytes)}，首屏 ${kb(m.firstScreenBytes)}`,
    )
    if (REPORT_ONLY) {
      const regular = m.weights.find((w) => w.weight === 400) ?? m.weights[0]
      for (const s of regular?.slices ?? []) {
        console.log(`    ${s.critical ? '★' : ' '} ${s.sliceId.padEnd(14)} ${kb(s.bytes)}`)
      }
    }
  }
  for (const s of skipped) console.log(`· 略過 ${s}`)
  for (const f of failures) console.error(`✗ ${f}`)

  if (manifests.length > 0) {
    reportPairings(manifests)
    console.log('')
    console.log(`manifest 寫到 assets/fonts-build/manifest.json`)
    console.log(`下一步：pnpm tsx scripts/upload-fonts.ts 上傳到 R2 並寫入 fonts 表`)
  }
  console.log('')
}

/**
 * 每組配對的首屏總量。
 *
 * 超過建議值不算失敗 —— 多字體配對是使用者的選擇（見 unicode-ranges.ts）。
 * 但**一定要印出來**：沒有人看得見的成本，最後就是使用者莫名其妙多等 130 KB。
 */
function reportPairings(manifests: FontManifest[]): void {
  const bytesBySlug = Object.fromEntries(manifests.map((m) => [m.slug, m.firstScreenBytes]))

  console.log('')
  console.log('字體配對的首屏總量：')
  for (const pair of FONT_PAIRINGS) {
    const slugs = [pair.heading, pair.body, pair.ui, pair.latin]
    const missing = [...new Set(slugs)].filter((s) => bytesBySlug[s] === undefined)
    if (missing.length > 0) {
      console.log(`  ? ${pair.name.padEnd(6)} 缺 ${missing.join('、')}，無法計算`)
      continue
    }
    const total = pairingFirstScreenBytes(slugs, bytesBySlug)
    const mark = total <= FIRST_SCREEN_BUDGET.pairing ? '✓' : '⚠'
    const fonts = new Set(slugs).size
    console.log(`  ${mark} ${pair.name.padEnd(6)} ${kb(total).padStart(9)}（${fonts} 套字體）`)
  }
}

if (process.argv[1]?.includes('build-fonts')) {
  await main()
}

export { detectWeight, isVariable, buildFont }
export type { FontManifest, WeightOutput, SliceOutput }
