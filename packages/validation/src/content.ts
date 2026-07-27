import { z } from 'zod'

/**
 * 內容池的格式與安全過濾。實作 09-content-pool.md。
 *
 * 內容檔在 `content/`（YAML），由 seed 匯入 DB。這裡是唯一的格式真相：
 * seed 腳本、check:content 檢查、未來的選取演算法都引用同一份 schema。
 */

/**
 * 硬性禁止的字樣（09-content-pool.md §9、07-agent.md §6.2）。
 *
 * 這是「在 prompt 裡寫『不要情緒勒索』」之外的**第二道**保證 ——
 * prompt 無法保證，正則可以。任何內容（含 AI 生成、含人寫、含我代寫）
 * 寫入前都要過這關。
 */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /連續\s*\d+\s*天沒(有)?來/, // 連續登入中斷羞辱
  /只剩\s*\d+\s*(小時|分鐘|天)/, // 假倒數
  /最後機會|即將消失|錯過就沒了|再不.*就來不及/, // 假稀缺
  // 情緒勒索。「沒有你」要收窄 —— 後面接標點或依賴詞（我/這/它/就/會/不）
  // 才是勒索（「沒有你，我…」「沒有你不行」）；「有沒有你沒看過」「沒有你的地址」
  // 這種無辜用法不該中。
  /我(很|好)?想念你|我等你|沒有你([，。！？,.!?]|我|這|它|就|會|便|不)|離不開你/,
  /你是不是(不喜歡|放棄|不在乎)/,
  /別人都(在|已經)/, // 製造比較與罪惡感
  /你一定(可以|做得到)的?[！!]/, // 空泛激勵（§5.5）
  /加油[！!]{2,}/, // 空喊口號
]

export function passesContentFilter(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

/** 過濾原因（供 check 腳本指出是哪一條）。 */
export function contentFilterReason(text: string): string | null {
  const hit = FORBIDDEN_PATTERNS.find((re) => re.test(text))
  return hit ? hit.source : null
}

/**
 * 把後台字串規則安全編譯成 RegExp。無效的正則（或過長）**跳過並不納入**，
 * 而不是讓整批過濾壞掉 —— 底線 FORBIDDEN_PATTERNS 永遠還在，跳過附加規則只是少一層。
 */
export function compileFilterPatterns(sources: readonly string[]): RegExp[] {
  const out: RegExp[] = []
  for (const src of sources) {
    if (typeof src !== 'string' || src.length === 0 || src.length > 200) continue
    try {
      out.push(new RegExp(src))
    } catch {
      // 無效正則：略過（呼叫端可另外記 log）
    }
  }
  return out
}

/**
 * 附加層過濾：底線 FORBIDDEN_PATTERNS + 後台附加規則。
 * extra 只能讓過濾**更嚴**，永遠不會放寬底線。
 */
export function passesContentFilterWith(text: string, extra: readonly RegExp[]): boolean {
  if (!passesContentFilter(text)) return false
  return !extra.some((re) => re.test(text))
}

// ── 共用欄位 ─────────────────────────────────────────────

const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{2,63}$/, 'id 必須是小寫字母開頭的 kebab（例如 q-action-001）')

const tagsSchema = z.array(z.string().regex(/^[a-z_]+$/)).max(6).default([])

const weightSchema = z.number().min(0.1).max(5).default(1)

// ── Quote ────────────────────────────────────────────────

export const quoteSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(4).max(60),
    tags: tagsSchema,
    weight: weightSchema.optional(),
    /** 新使用者不該看到「你已累積很多作品」這類內容 */
    minDaysSinceSignup: z.number().int().min(0).max(3650).optional(),
    requiresTag: z.string().regex(/^[a-z_]+$/).optional(),
    cooldownDays: z.number().int().min(1).max(365).optional(),
  })
  .strict()

// ── Creative Prompt ──────────────────────────────────────

export const promptSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(6).max(80),
    tags: tagsSchema,
    weight: weightSchema.optional(),
    /** 選取演算法用它給低能量使用者優先低門檻提示 */
    estimatedMinutes: z.number().int().min(1).max(120),
    minDaysSinceSignup: z.number().int().min(0).max(3650).optional(),
    requiresTag: z.string().regex(/^[a-z_]+$/).optional(),
    cooldownDays: z.number().int().min(1).max(365).optional(),
  })
  .strict()

// ── 每日一問（反思提問）──────────────────────────────────
// 每日輪替（像 quote/prompt）。一句開放式問題，邀請使用者想一下自己。
export const questionSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(6).max(80),
    tags: tagsSchema,
    weight: weightSchema.optional(),
    minDaysSinceSignup: z.number().int().min(0).max(3650).optional(),
    requiresTag: z.string().regex(/^[a-z_]+$/).optional(),
    cooldownDays: z.number().int().min(1).max(365).optional(),
  })
  .strict()

// ── 微行動（2 分鐘小任務）────────────────────────────────
// 每日輪替。一個當下就能做完的小動作，降低開始門檻。
export const microActionSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(4).max(80),
    tags: tagsSchema,
    weight: weightSchema.optional(),
    /** 預設就是 ~2 分鐘，可覆寫 */
    estimatedMinutes: z.number().int().min(1).max(15).optional(),
    minDaysSinceSignup: z.number().int().min(0).max(3650).optional(),
    requiresTag: z.string().regex(/^[a-z_]+$/).optional(),
    cooldownDays: z.number().int().min(1).max(365).optional(),
  })
  .strict()

// ── Greeting（依時段分組）────────────────────────────────

export const greetingSchema = z
  .object({
    id: idSchema,
    text: z.string().trim().min(2).max(40),
    weight: weightSchema.optional(),
    requiresBackgroundChanged: z.boolean().optional(),
  })
  .strict()

export const GREETING_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const
export type GreetingSlot = (typeof GREETING_SLOTS)[number]

export const greetingsFileSchema = z
  .object({
    morning: z.array(greetingSchema).default([]),
    afternoon: z.array(greetingSchema).default([]),
    evening: z.array(greetingSchema).default([]),
    night: z.array(greetingSchema).default([]),
  })
  .strict()

// ── Surprise ─────────────────────────────────────────────

export const SURPRISE_RARITIES = ['common', 'uncommon', 'rare', 'special', 'anniversary'] as const
export type SurpriseRarity = (typeof SURPRISE_RARITIES)[number]

export const surpriseSchema = z
  .object({
    id: idSchema,
    /** 打開前的外觀文字（盒子上寫什麼） */
    label: z.string().trim().min(2).max(24),
    /** 打開後看到的內容 */
    text: z.string().trim().min(4).max(200),
    tags: tagsSchema,
    weight: weightSchema.optional(),
    minDaysSinceSignup: z.number().int().min(0).max(3650).optional(),
  })
  .strict()

// ── 生日鏈 ───────────────────────────────────────────────

export const chainLinkSchema = z
  .object({
    id: idSchema,
    /** 0 起算的環節序號，決定顯示順序 */
    chainIndex: z.number().int().min(0).max(10),
    title: z.string().trim().min(2).max(40),
    text: z.string().trim().min(4).max(2000),
    /** 條件而非時間（09-content-pool.md §7）：達成才解鎖 */
    availableFrom: z
      .enum(['immediately', 'after_first_theme', 'after_first_upload', 'after_7_days', 'after_1_year'])
      .default('immediately'),
  })
  .strict()

export type Quote = z.infer<typeof quoteSchema>
export type Prompt = z.infer<typeof promptSchema>
export type Question = z.infer<typeof questionSchema>
export type MicroAction = z.infer<typeof microActionSchema>
export type Greeting = z.infer<typeof greetingSchema>
export type Surprise = z.infer<typeof surpriseSchema>
export type ChainLink = z.infer<typeof chainLinkSchema>
