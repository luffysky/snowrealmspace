import subsetFont from 'subset-font'
import {
  slicesForScripts,
  budgetForScripts,
  parseUnicodeRange,
  firstScreenBudget,
  type UnicodeSlice,
} from '@snowrealm/theme-engine'

/**
 * 記憶體內字體子集化。
 *
 * 這是 `scripts/build-fonts.ts` 的執行期版本：後台上傳的原始 ttf/otf 直接在
 * route 內切成 unicode-range 分片（woff2），不落地 assets/。邏輯必須與那支腳本
 * 一致（同一套分片、同一個首屏預算），否則 UI 端 @font-face 會對不上。
 *
 * ## 只給後台安裝「內建目錄的 OFL 字體」用
 *
 * ADR-016：字體是全域參考資料，使用者不可上傳自有字體（無法驗證授權範圍）。
 * 這裡的 metadata（scripts/weights/授權）一律來自 `ALL_FONTS` 目錄，呼叫端已先
 * 用 slug 對應到目錄項目 —— 也就是說只是把「人工下載＋跑 CLI」搬到後台按鈕。
 */

export type BuiltSlice = {
  sliceId: string
  /** 檔名（basename），例如 taipei-sans-tc-400-cjk-core.woff2 */
  file: string
  unicodeRange: string
  bytes: number
  critical: boolean
  body: Uint8Array
}

export type BuiltWeight = { weight: number; source: string; slices: BuiltSlice[] }

export type BuiltFont = {
  slug: string
  subsetStrategy: 'unicode_range' | 'static'
  weights: BuiltWeight[]
  totalBytes: number
  firstScreenBytes: number
  withinBudget: boolean
  budgetLimit: number
  overBy: number
}

/** 檔名裡的字重標記 → 數值。各家命名不一致，全部列出來比猜可靠（同 build-fonts）。 */
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

async function buildSlice(
  source: Buffer,
  slug: string,
  weight: number,
  slice: UnicodeSlice,
  variable: boolean,
): Promise<BuiltSlice | null> {
  const text = String.fromCodePoint(...parseUnicodeRange(slice.range))

  const subset = await subsetFont(source, text, {
    targetFormat: 'woff2',
    // 固定 wght 軸 → 產出單一字重的靜態實例（可變字體必做，否則每片都帶全部字重）。
    ...(variable ? { variationAxes: { wght: weight } } : {}),
  })

  // harfbuzz 對完全沒命中的子集仍會產出最小合法檔（純 header）。
  // 1 KB 以下不可能有可見字形 → 視為「這片沒字」，不產生 404 的 @font-face。
  if (subset.byteLength < 1024) return null

  return {
    sliceId: slice.id,
    file: `${slug}-${weight}-${slice.id}.woff2`,
    unicodeRange: slice.range,
    bytes: subset.byteLength,
    critical: slice.critical,
    body: subset,
  }
}

/**
 * 把上傳的原始字體檔子集化成分片。回傳結果只在記憶體，呼叫端負責上傳 R2。
 *
 * @throws 若沒有可用檔案、或沒有對應宣告字重的檔案。
 */
export async function subsetUploadedFont(input: {
  slug: string
  scripts: readonly string[]
  /** 目錄宣告的字重，只產出這些。 */
  weights: readonly number[]
  files: { name: string; body: Uint8Array }[]
}): Promise<BuiltFont> {
  const slices = slicesForScripts(input.scripts)

  // 斜體不做（中文機械傾斜會壞字形；拉丁斜體目前無 UI 用得到）。
  const upright = input.files.filter((f) => !/italic/i.test(f.name))
  if (upright.length === 0) throw new Error('沒有可用的字體檔（.ttf / .otf）')

  const built: BuiltWeight[] = []

  for (const file of upright) {
    const variable = isVariable(file.name)
    const targetWeights = variable ? input.weights : [detectWeight(file.name)]
    const source = Buffer.from(file.body)

    for (const weight of targetWeights) {
      if (!input.weights.includes(weight)) continue
      if (built.some((w) => w.weight === weight)) continue

      const sliceOutputs: BuiltSlice[] = []
      for (const slice of slices) {
        const out = await buildSlice(source, input.slug, weight, slice, variable)
        if (out) sliceOutputs.push(out)
      }
      built.push({ weight, source: file.name, slices: sliceOutputs })
    }
  }

  if (built.length === 0) {
    throw new Error(`上傳的檔案沒有對應宣告字重 [${input.weights.join(', ')}]`)
  }

  built.sort((a, b) => a.weight - b.weight)

  const allSlices = built.flatMap((w) => w.slices)
  const totalBytes = allSlices.reduce((n, s) => n + s.bytes, 0)

  // 首屏成本只算 400 字重的 critical 分片（首屏不會同時用到所有字重）。
  const regular = built.find((w) => w.weight === 400) ?? built[0]!
  const limit = budgetForScripts(input.scripts)
  const budget = firstScreenBudget(
    regular.slices.map((s) => ({ bytes: s.bytes, critical: s.critical })),
    limit,
  )

  return {
    slug: input.slug,
    subsetStrategy: input.scripts.includes('zh-Hant') ? 'unicode_range' : 'static',
    weights: built,
    totalBytes,
    firstScreenBytes: budget.totalBytes,
    withinBudget: budget.withinBudget,
    budgetLimit: limit,
    overBy: budget.overBy,
  }
}
