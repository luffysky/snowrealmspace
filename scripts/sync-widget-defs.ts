/**
 * 只同步 widget_definitions（從註冊表 upsert），不動 feature_flags 或其他資料。
 *
 * 為什麼獨立於 seed.ts：seed.ts 會把所有 feature_flags 覆寫成 enabled=false，
 * 在正式環境跑會清掉已開啟的 flag。新增 widget 只需要補定義列，用這支就好。
 *
 * widget_instances.widget_definition_id 對 widget_definitions 有 FK（on delete restrict），
 * 沒補這張表的話新增 widget 只會噴外鍵違反，指不到真正原因（註冊表有、DB 沒有）。
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const { createAdminClient } = await import('@snowrealm/db/server')
const { WIDGET_REGISTRY } = await import('@snowrealm/widget-engine')

async function main() {
  const db = createAdminClient()
  const rows = Object.values(WIDGET_REGISTRY).map((def, index) => ({
    id: def.id,
    name: def.name,
    version: def.version,
    category: def.category,
    description: def.description,
    default_w: def.defaultSize.w,
    default_h: def.defaultSize.h,
    min_w: def.minSize.w,
    min_h: def.minSize.h,
    max_w: def.maxSize.w,
    max_h: def.maxSize.h,
    config_schema: {} as never,
    permissions: def.permissions,
    feature_flag: (def as { featureFlag?: string }).featureFlag ?? null,
    enabled: true,
    sort_order: index,
  }))

  const { error } = await db.from('widget_definitions').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`同步 widget_definitions 失敗：${error.message}`)
  console.log(`✓ widget_definitions 已同步：${rows.length} 個 widget`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
