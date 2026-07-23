/**
 * 檢查機密沒有洩漏到會送給瀏覽器的程式碼。
 *
 * 見 docs/spec/11-engineering-setup.md §3。
 * 這個檢查的價值在於它抓的是「一次就致命」的錯誤 ——
 * service role key 進了 client bundle，等於 RLS 完全失效。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

/** 這些名稱絕不可出現在 client 端程式碼中。 */
const SERVER_ONLY = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'R2_SECRET_ACCESS_KEY',
  'R2_ACCESS_KEY_ID',
  'AI_KEY_ENCRYPTION_SECRET',
  'TOKEN_ENCRYPTION_SECRET',
  'CRON_SECRET',
  'ANTHROPIC_API_KEY',
  'FIGMA_CLIENT_SECRET',
  'FIGMA_WEBHOOK_SECRET',
]

/** 看起來像實際金鑰的樣式（避免有人把金鑰硬編進程式碼）。 */
const KEY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Supabase service_role JWT', re: /eyJ[\w-]+\.eyJ[\w-]*InNlcnZpY2Vfcm9sZSI/ },
  { name: 'Anthropic API key', re: /sk-ant-[\w-]{20,}/ },
  { name: 'OpenAI API key', re: /sk-proj-[\w-]{20,}/ },
  { name: 'AWS/R2 secret', re: /aws_secret_access_key\s*=\s*['"][\w/+]{30,}/i },
]

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  '.git',
  'coverage',
  'test-results',
])

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|css)$/

type Finding = { file: string; issue: string }

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out)
    else if (SOURCE_EXT.test(entry.name)) out.push(full)
  }
  return out
}

async function main() {
  const files = await walk(ROOT)
  const findings: Finding[] = []

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    const content = await readFile(file, 'utf8')

    // 1. 硬編的金鑰樣式 —— 任何檔案都不可以
    for (const { name, re } of KEY_PATTERNS) {
      if (re.test(content)) {
        findings.push({ file: rel, issue: `疑似硬編的${name}` })
      }
    }

    // 2. 'use client' 檔案不可引用伺服器端環境變數
    const isClientComponent = /^\s*['"]use client['"]/m.test(content)
    if (isClientComponent) {
      for (const key of SERVER_ONLY) {
        if (content.includes(key)) {
          findings.push({ file: rel, issue: `client component 引用了伺服器端變數 ${key}` })
        }
      }
    }

    // 3. 伺服器端變數不可加上 NEXT_PUBLIC_ 前綴（那會被 inline 進 bundle）
    for (const key of SERVER_ONLY) {
      if (content.includes(`NEXT_PUBLIC_${key}`)) {
        findings.push({ file: rel, issue: `${key} 不可有 NEXT_PUBLIC_ 前綴` })
      }
    }
  }

  console.log(`掃描了 ${files.length} 個檔案。`)

  if (findings.length > 0) {
    console.error(`\n✗ 發現 ${findings.length} 個問題：\n`)
    for (const f of findings) console.error(`  ${f.file}\n    ${f.issue}`)
    console.error('')
    process.exit(1)
  }

  console.log('✓ 沒有發現機密洩漏。')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
