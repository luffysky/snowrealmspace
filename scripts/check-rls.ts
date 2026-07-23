/**
 * 檢查每張帶 space_id 的表都有 RLS 啟用與至少一條 policy。
 *
 * ADR-003 / docs/spec/03-database.md §15。
 * 這個檢查在 CI 執行 —— 忘了寫 policy 會讓 build 失敗，而不是等到資料外洩才發現。
 */
import postgres from 'postgres'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

/**
 * 這些表沒有 space_id 欄位，但仍必須啟用 RLS。
 * `spaces` 是租戶表本身 —— 它的 id 就是 space_id。
 */
const REQUIRED_RLS_WITHOUT_SPACE_ID = ['profiles', 'feature_flags', 'spaces']

/** 租戶表本身、純參考資料、系統表：允許沒有 space_id 欄位。 */
const ALLOWLIST_NO_SPACE_ID = new Set([
  'schema_migrations',
  'spaces',
  'profiles',
  'feature_flags',
  'fonts',
  'font_pairs',
  'widget_definitions',
  'provider_webhooks',
  'ai_models',
  'ai_provider_keys',
  'ai_usage_models',
])

type Problem = { table: string; issue: string }

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('缺少 DATABASE_URL')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} })
  const problems: Problem[] = []

  try {
    const tables = await sql<{ tablename: string; rls_enabled: boolean }[]>`
      select c.relname as tablename, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `

    const withSpaceId = new Set(
      (
        await sql<{ table_name: string }[]>`
          select table_name from information_schema.columns
          where table_schema = 'public' and column_name = 'space_id'
        `
      ).map((r) => r.table_name),
    )

    const policyCounts = new Map(
      (
        await sql<{ tablename: string; n: string }[]>`
          select tablename, count(*)::text as n from pg_policies
          where schemaname = 'public' group by tablename
        `
      ).map((r) => [r.tablename, Number(r.n)]),
    )

    for (const { tablename, rls_enabled } of tables) {
      if (tablename === 'schema_migrations') continue

      const hasSpaceId = withSpaceId.has(tablename)
      const needsRls = hasSpaceId || REQUIRED_RLS_WITHOUT_SPACE_ID.includes(tablename)
      const policies = policyCounts.get(tablename) ?? 0

      if (needsRls && !rls_enabled) {
        problems.push({ table: tablename, issue: '未啟用 RLS' })
      }
      if (needsRls && policies === 0) {
        problems.push({ table: tablename, issue: '啟用了 RLS 但沒有任何 policy（等於全部拒絕）' })
      }
      if (!hasSpaceId && !ALLOWLIST_NO_SPACE_ID.has(tablename)) {
        problems.push({
          table: tablename,
          issue: '缺少 space_id。承載使用者內容的表必須有租戶鍵（ADR-006）',
        })
      }
    }

    console.log(`檢查了 ${tables.length - 1} 張表。`)

    if (problems.length > 0) {
      console.error(`\n✗ 發現 ${problems.length} 個問題：\n`)
      for (const p of problems) console.error(`  ${p.table}: ${p.issue}`)
      console.error('')
      process.exit(1)
    }

    console.log('✓ 所有表的 RLS 設定正確。')
  } finally {
    await sql.end()
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
