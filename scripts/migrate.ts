/**
 * Migration runner。
 *
 * 不用 Supabase CLI 的理由：CLI 需要 Docker 起本地 stack，而我們的 migration
 * 也要能對 hosted Supabase 執行。直接跑 SQL 讓兩種情境用同一條路徑。
 *
 * 用法：
 *   pnpm db:migrate            套用所有未套用的 migration
 *   pnpm db:migrate --reset    先 drop public schema 再全部重跑（僅限非 production）
 *   pnpm db:migrate --dry-run  只列出將要執行的檔案
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

const args = new Set(process.argv.slice(2))
const isReset = args.has('--reset')
const isDryRun = args.has('--dry-run')

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      '缺少 DATABASE_URL。\n' +
        '  本機：postgresql://postgres:postgres@localhost:54322/postgres\n' +
        '  Supabase：專案設定 → Database → Connection string（URI）',
    )
    process.exit(1)
  }
  return url
}

async function main() {
  const databaseUrl = requireDatabaseUrl()

  if (isReset && process.env.NODE_ENV === 'production') {
    console.error('拒絕在 production 執行 --reset。')
    process.exit(1)
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })

  try {
    if (isReset) {
      console.log('⚠  --reset：清空 public schema…')
      await sql.unsafe(`drop schema if exists public cascade; create schema public;`)
      await sql.unsafe(`grant usage on schema public to anon, authenticated, service_role;`)
      await sql.unsafe(`grant all on schema public to postgres;`)
    }

    await sql.unsafe(`
      create table if not exists schema_migrations (
        version    text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now()
      );
    `)

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
    if (files.length === 0) {
      console.log('沒有 migration 檔案。')
      return
    }

    const applied = await sql<{ version: string; checksum: string }[]>`
      select version, checksum from schema_migrations
    `
    const appliedMap = new Map(applied.map((r) => [r.version, r.checksum]))

    let ranCount = 0
    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      const checksum = createHash('sha256').update(body).digest('hex').slice(0, 16)
      const previous = appliedMap.get(version)

      if (previous !== undefined) {
        if (previous !== checksum) {
          // 已套用的 migration 被修改過。這幾乎總是錯誤：其他環境已經跑過舊版本。
          console.error(
            `\n✗ ${file} 的內容在套用後被修改。\n` +
              `  已套用 checksum: ${previous}\n` +
              `  目前檔案 checksum: ${checksum}\n` +
              `  請改為新增一個 migration，而不是修改已套用的。`,
          )
          process.exit(1)
        }
        continue
      }

      if (isDryRun) {
        console.log(`[dry-run] 將執行 ${file}`)
        ranCount++
        continue
      }

      process.stdout.write(`→ ${file} … `)
      // 每個 migration 在自己的 transaction 內，失敗即整檔回滾
      await sql.begin(async (tx) => {
        await tx.unsafe(body)
        await tx`
          insert into schema_migrations (version, checksum) values (${version}, ${checksum})
        `
      })
      console.log('OK')
      ranCount++
    }

    if (ranCount === 0) console.log('已是最新，無需套用。')
    else if (!isDryRun) console.log(`\n完成，套用了 ${ranCount} 個 migration。`)
  } finally {
    await sql.end()
  }
}

main().catch((err: unknown) => {
  console.error('\nMigration 失敗：')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
