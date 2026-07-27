import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import {
  quoteSchema,
  promptSchema,
  questionSchema,
  microActionSchema,
  seasonalSchema,
  milestoneSchema,
  welcomeSchema,
  greetingsFileSchema,
  surpriseSchema,
  chainLinkSchema,
  contentFilterReason,
  GREETING_SLOTS,
} from '@snowrealm/validation'
import type { z } from 'zod'

/**
 * 內容池檢查。09-content-pool.md。
 *
 * 這是子代理產出的把關：每一則都要
 *   1. 符合 schema（id、長度、必填欄位）
 *   2. 通過 FORBIDDEN_PATTERNS（不情緒勒索、不假稀缺、不空泛激勵）
 *   3. id 全域唯一
 *   4. 文字不重複、也不近似重複（10 年份量最怕的是「換句話說的同一句」）
 * 並統計數量、對照門檻。
 *
 * 用法：pnpm check:content
 *
 * ⚠️ 這個檢查經過變異測試：植入一則情緒勒索、一則重複 id、
 * 一組近似重複的文字，都必須被抓到。
 */

const ROOT = join(import.meta.dirname, '..')
const CONTENT = join(ROOT, 'content')

/** 各類的數量門檻。10 年份量的設計見 09-content-pool.md §7.2。 */
const THRESHOLDS = {
  // 10 年 × 365 天，每天一則不重複 → 3650 是下限（使用者指示）。
  quotes: 3650,
  prompts: 3650,
  questions: 3650, // 每日一問也走每日輪替
  microActions: 3650, // 微行動也走每日輪替
  seasonal: 120, // 依節氣挑（24 節氣，非每日唯一）；每節氣 ~5 則即足
  milestone: 30, // 依註冊天數觸發（節點有限），每節點數則即足
  welcome: 365, // 歡迎鏈每日輪替；一年份即足
  greetings: 3650, // 使用者要求每時段補到 ~1000（共 ~4000）
  surprises: 600,
  chain: 5,
} as const

type Problem = { file: string; message: string }

async function main() {
  const problems: Problem[] = []
  const allIds = new Map<string, string>() // id → 第一次出現的檔案
  const allTexts = new Map<string, string>() // 正規化文字 → id

  const counts = { quotes: 0, prompts: 0, questions: 0, microActions: 0, seasonal: 0, milestone: 0, welcome: 0, greetings: 0, surprises: 0, chain: 0 }

  // ── Quotes ──
  for (const { file, rows } of await loadDir('daily/quotes')) {
    for (const raw of rows) {
      const check = validateRow(quoteSchema, raw, file, allIds, allTexts, problems)
      if (check) counts.quotes++
    }
  }

  // ── Prompts ──
  for (const { file, rows } of await loadDir('daily/prompts')) {
    for (const raw of rows) {
      const check = validateRow(promptSchema, raw, file, allIds, allTexts, problems)
      if (check) counts.prompts++
    }
  }

  // ── 每日一問 ──
  for (const { file, rows } of await loadDir('daily/questions')) {
    for (const raw of rows) {
      if (validateRow(questionSchema, raw, file, allIds, allTexts, problems)) counts.questions++
    }
  }

  // ── 微行動 ──
  for (const { file, rows } of await loadDir('daily/micro-actions')) {
    for (const raw of rows) {
      if (validateRow(microActionSchema, raw, file, allIds, allTexts, problems)) counts.microActions++
    }
  }

  // ── 季節·節氣 ──
  for (const { file, rows } of await loadDir('daily/seasonal')) {
    for (const raw of rows) {
      if (validateRow(seasonalSchema, raw, file, allIds, allTexts, problems)) counts.seasonal++
    }
  }

  // ── 里程碑回顧 ──
  for (const { file, rows } of await loadDir('daily/milestone')) {
    for (const raw of rows) {
      if (validateRow(milestoneSchema, raw, file, allIds, allTexts, problems)) counts.milestone++
    }
  }

  // ── 歡迎鏈 ──
  for (const { file, rows } of await loadDir('daily/welcome')) {
    for (const raw of rows) {
      if (validateRow(welcomeSchema, raw, file, allIds, allTexts, problems)) counts.welcome++
    }
  }

  // ── Greetings（依時段分組的單一檔或多檔）──
  for (const { file, doc } of await loadDocs('daily', /greetings.*\.ya?ml$/)) {
    const parsed = greetingsFileSchema.safeParse(doc)
    if (!parsed.success) {
      problems.push({ file, message: formatZod(parsed.error) })
      continue
    }
    for (const slot of GREETING_SLOTS) {
      for (const g of parsed.data[slot]) {
        registerId(g.id, file, allIds, problems)
        registerText(g.text, g.id, allTexts, problems, file)
        checkForbidden(g.text, file, problems)
        // night 不得催促（§4.3）
        if (slot === 'night' && /還沒|快點|該|未完成|進度|加油/.test(g.text)) {
          problems.push({ file, message: `night 問候不得催促：「${g.text}」` })
        }
        counts.greetings++
      }
    }
  }

  // ── Surprises ──
  for (const { file, rows } of await loadDir('surprise')) {
    for (const raw of rows) {
      const parsed = surpriseSchema.safeParse(raw)
      if (!parsed.success) {
        problems.push({ file, message: `${idOf(raw)}: ${formatZod(parsed.error)}` })
        continue
      }
      registerId(parsed.data.id, file, allIds, problems)
      registerText(parsed.data.text, parsed.data.id, allTexts, problems, file)
      checkForbidden(parsed.data.text, file, problems)
      checkForbidden(parsed.data.label, file, problems)
      counts.surprises++
    }
  }

  // ── 生日鏈 ──
  for (const { file, rows } of await loadDir('chain')) {
    for (const raw of rows) {
      const parsed = chainLinkSchema.safeParse(raw)
      if (!parsed.success) {
        problems.push({ file, message: `${idOf(raw)}: ${formatZod(parsed.error)}` })
        continue
      }
      registerId(parsed.data.id, file, allIds, problems)
      checkForbidden(parsed.data.text, file, problems)
      counts.chain++
    }
  }

  report(counts, problems)
  if (problems.length > 0) process.exit(1)

  // 門檻是警告不是錯誤 —— 內容是逐步累積的，低於門檻要提醒但不擋
  const below = Object.entries(THRESHOLDS).filter(
    ([k, min]) => counts[k as keyof typeof counts] < min,
  )
  if (below.length > 0) {
    console.warn('\n⚠ 以下類別尚未達到 10 年份量門檻：')
    for (const [k, min] of below) {
      console.warn(`  ${k}: ${counts[k as keyof typeof counts]} / ${min}`)
    }
  } else {
    console.log('\n✓ 所有類別都達到 10 年份量門檻。')
  }
}

// ── 載入 ─────────────────────────────────────────────────

async function loadDir(
  rel: string,
): Promise<{ file: string; rows: unknown[] }[]> {
  const dir = join(CONTENT, rel)
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f))
  const out: { file: string; rows: unknown[] }[] = []
  for (const f of files) {
    const doc = parse(await readFile(join(dir, f), 'utf8')) as unknown
    out.push({ file: `${rel}/${f}`, rows: Array.isArray(doc) ? doc : [] })
  }
  return out
}

async function loadDocs(
  rel: string,
  pattern: RegExp,
): Promise<{ file: string; doc: unknown }[]> {
  const dir = join(CONTENT, rel)
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter((f) => pattern.test(f))
  const out: { file: string; doc: unknown }[] = []
  for (const f of files) {
    out.push({ file: `${rel}/${f}`, doc: parse(await readFile(join(dir, f), 'utf8')) })
  }
  return out
}

// ── 驗證輔助 ─────────────────────────────────────────────

function validateRow<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  file: string,
  allIds: Map<string, string>,
  allTexts: Map<string, string>,
  problems: Problem[],
): boolean {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    problems.push({ file, message: `${idOf(raw)}: ${formatZod(parsed.error)}` })
    return false
  }
  const row = parsed.data as { id: string; text: string }
  registerId(row.id, file, allIds, problems)
  registerText(row.text, row.id, allTexts, problems, file)
  checkForbidden(row.text, file, problems)
  return true
}

function registerId(id: string, file: string, allIds: Map<string, string>, problems: Problem[]) {
  const existing = allIds.get(id)
  if (existing) {
    problems.push({ file, message: `id 重複：${id}（也出現在 ${existing}）` })
  } else {
    allIds.set(id, file)
  }
}

/**
 * 近似重複偵測。
 *
 * 完全相同的文字一定要抓。但「10 年份量」真正的風險是換句話說的同一句 ——
 * 移除標點與空白後比對，能抓到「先做出來，再做好」與「先做出來再做好。」
 * 這類實質重複。完全的語意去重需要 embedding，那留到有 AI 之後。
 */
function registerText(
  text: string,
  id: string,
  allTexts: Map<string, string>,
  problems: Problem[],
  file: string,
) {
  const normalized = text.replace(/[\s，。！？、,.!?~～…—-]/g, '')
  const existing = allTexts.get(normalized)
  if (existing) {
    problems.push({ file, message: `文字近似重複：${id} 與 ${existing}（「${text}」）` })
  } else {
    allTexts.set(normalized, id)
  }
}

function checkForbidden(text: string, file: string, problems: Problem[]) {
  const reason = contentFilterReason(text)
  if (reason) {
    problems.push({ file, message: `觸犯 FORBIDDEN_PATTERNS（/${reason}/）：「${text}」` })
  }
}

function idOf(raw: unknown): string {
  return (raw as { id?: string })?.id ?? '(無 id)'
}

function formatZod(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')
}

function report(counts: Record<string, number>, problems: Problem[]) {
  console.log('內容池統計：')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)

  if (problems.length === 0) {
    console.log('\n✓ 格式、id 唯一性、安全過濾、去重全部通過。')
    return
  }
  console.error(`\n✗ 發現 ${problems.length} 個問題：`)
  for (const p of problems.slice(0, 50)) console.error(`  [${p.file}] ${p.message}`)
  if (problems.length > 50) console.error(`  …還有 ${problems.length - 50} 個`)
}

await main()
