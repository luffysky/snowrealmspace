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
const REQUIRED_RLS_WITHOUT_SPACE_ID = [
  'profiles',
  'feature_flags',
  'spaces',
  // 登入方式屬於「人」不屬於 space —— 一個人可以在多個 space，
  // 但登入方式只有一組。隔離鍵是 user_id，policy 為 user_id = auth.uid()。
  'user_identities',
  'oauth_transactions',
]

/**
 * RLS 開著但**刻意**沒有任何 policy 的表 —— 等於對所有一般角色全拒絕，
 * 只有 service role（繞過 RLS）能存取。
 *
 * 這份名單必須很短且逐一寫明理由。預設情況下「開了 RLS 卻沒有 policy」
 * 幾乎都是寫錯 —— 那個檢查要留著，這裡只放真的想要全拒絕的。
 */
const SERVICE_ROLE_ONLY = new Set([
  // OAuth 的 state / nonce。只在 callback 由 service role 讀寫，
  // 使用者連自己那筆都不需要看到，讓他看到反而擴大攻擊面。
  'oauth_transactions',
])

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
  // 使用者層級而非 space 層級，理由見 REQUIRED_RLS_WITHOUT_SPACE_ID
  'user_identities',
  'oauth_transactions',
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
      if (needsRls && policies === 0 && !SERVICE_ROLE_ONLY.has(tablename)) {
        problems.push({ table: tablename, issue: '啟用了 RLS 但沒有任何 policy（等於全部拒絕）' })
      }
      // 反向檢查：宣稱只給 service role 的表，若有人偷加 policy 要抓出來
      if (SERVICE_ROLE_ONLY.has(tablename) && policies > 0) {
        problems.push({
          table: tablename,
          issue: `列在 SERVICE_ROLE_ONLY 卻有 ${policies} 條 policy。要嘛移出名單，要嘛移除 policy。`,
        })
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
