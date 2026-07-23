import { z } from 'zod'

/**
 * 啟動時驗證環境變數。缺必要變數直接崩潰，勝過執行到一半才發現。
 * 見 docs/spec/11-engineering-setup.md §3。
 */

const base64_32Bytes = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, '必須是 32 bytes 的 base64（用 openssl rand -base64 32 產生）')

/** 空字串視為未設定。Zeabur 等平台會把未填的變數傳成 ''，不是 undefined。 */
const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema)

/** 伺服器端才可讀的變數。絕不可出現在 client bundle。 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  /**
   * R2 儲存全部 optional —— 沒設定時 app 仍能啟動與登入/註冊，
   * 只有真正用到上傳/背景圖時才會清楚報「R2 尚未設定」（見 packages/storage/r2.ts）。
   * 這是可選功能，不該讓整個 app 起不來（同 OAuth 的處理）。
   */
  R2_ACCOUNT_ID: emptyToUndef(z.string().min(1).optional()),
  R2_ACCESS_KEY_ID: emptyToUndef(z.string().min(1).optional()),
  R2_SECRET_ACCESS_KEY: emptyToUndef(z.string().min(1).optional()),
  R2_BUCKET: emptyToUndef(z.string().min(1).optional()),
  R2_PUBLIC_BASE_URL: emptyToUndef(z.string().url().optional()),
  /**
   * 覆寫 R2 端點。本機開發指向 S3 相容的本地服務；production 留空以使用真正的 R2。
   * 有這個選項才能在不申請 Cloudflare 帳號的情況下跑完整流程。
   */
  R2_ENDPOINT: emptyToUndef(z.string().url().optional()),
  R2_REGION: z.string().default('auto'),
  /** 部分 S3 相容服務不支援 virtual-host 定址，需要 path-style。 */
  R2_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  AI_KEY_ENCRYPTION_SECRET: base64_32Bytes,
  TOKEN_ENCRYPTION_SECRET: base64_32Bytes,
  CRON_SECRET: z.string().min(32),

  // AI 金鑰全部 optional —— 路由層會跳過沒金鑰的候選（ADR-023）。
  // 開發時只需設一把免費金鑰即可跑起整個產品。
  GROQ_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  SAMBANOVA_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_AI_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // 第三方登入（13-third-party-auth.md §8）。
  // 全部 optional：沒設就在設定頁顯示為「尚未設定」並停用，
  // 而不是讓整個 app 起不來 —— 這是可選功能，不是必要相依。
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  LINE_LOGIN_CHANNEL_ID: z.string().optional(),
  LINE_LOGIN_CHANNEL_SECRET: z.string().optional(),
  /** 必須與 LINE Console 設定的完全一致，多一個斜線就會被拒。 */
  LINE_LOGIN_REDIRECT_URI: z.string().url().optional(),

  FIGMA_CLIENT_ID: z.string().optional(),
  FIGMA_CLIENT_SECRET: z.string().optional(),
  FIGMA_WEBHOOK_SECRET: z.string().optional(),
})

/** 可以進 client bundle 的變數。 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type PublicEnv = z.infer<typeof publicSchema>

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
}

let cachedServerEnv: (ServerEnv & PublicEnv) | null = null

/**
 * 伺服器端環境變數。第一次呼叫時驗證並快取。
 * 驗證失敗時拋出，且訊息中「絕不」包含任何變數的值。
 */
export function serverEnv(): ServerEnv & PublicEnv {
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.merge(publicSchema).safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `環境變數驗證失敗：\n${formatIssues(parsed.error)}\n\n` +
        `請對照 .env.example 檢查 .env.local。`,
    )
  }
  cachedServerEnv = parsed.data
  return cachedServerEnv
}

/** 前端環境變數。Next.js 會在 build 時 inline NEXT_PUBLIC_*，所以必須逐一列出。 */
export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  if (!parsed.success) {
    throw new Error(`公開環境變數驗證失敗：\n${formatIssues(parsed.error)}`)
  }
  return parsed.data
}

/** 測試用：清除快取，讓下次 serverEnv() 重新驗證。 */
export function resetEnvCache(): void {
  cachedServerEnv = null
}
