/**
 * Seed 參考資料。
 *
 * 字體（ADR-016）會隨字體檔案到位後加入。
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const { createAdminClient } = await import('@snowrealm/db/server')
const { FEATURE_FLAG_KEYS } = await import('@snowrealm/shared-types')
const { WIDGET_REGISTRY } = await import('@snowrealm/widget-engine')

/**
 * ADR-018：所有未完成的大功能一律預設關閉。
 * 關閉時路由與 API 都必須回 404，不只是隱藏按鈕。
 */
const FLAG_DESCRIPTIONS: Record<string, string> = {
  figmaIntegration: 'Figma OAuth 與檔案同步（Milestone F）',
  canvaConnect: 'Canva Connect API（V2）',
  canvaApp: 'Canva 編輯器內建 App（V2）',
  adobeExpress: 'Adobe Express Add-on（V2）',
  photoshopPlugin: 'Photoshop UXP Plugin（V2）',
  publicPortfolio: '公開作品集頁面（V2）',
  collaboration: '協作者角色（V2）',
  marketplace: '主題與 Widget 市集（V3）',
  videoBackground: '影片背景，含 30 秒 / 20MB 限制（ADR-019，Milestone B）',
  semanticSearch: '語意搜尋（V2）',
  weeklyRecap: '每週回顧（Milestone E）',
}

async function main() {
  const db = createAdminClient()

  // ── Feature flags ──
  const flagRows = FEATURE_FLAG_KEYS.map((key) => ({
    key,
    description: FLAG_DESCRIPTIONS[key] ?? null,
    enabled: false,
  }))

  const { error: flagError } = await db
    .from('feature_flags')
    .upsert(flagRows, { onConflict: 'key' })
  if (flagError) throw new Error(`寫入 feature_flags 失敗：${flagError.message}`)
  console.log(`✓ feature_flags：${flagRows.length} 個 flag（全部預設關閉）`)

  /*
   * ── Widget 定義 ──
   *
   * widget_instances.widget_definition_id 對這張表有 FK（on delete restrict）。
   * 沒 seed 的話新增 widget 會失敗，而錯誤訊息只是外鍵違反 ——
   * 完全指不到「註冊表在 TypeScript 但資料庫是空的」這個真正原因。
   *
   * 註冊表是唯一真相，這裡只是把它同步進資料庫。
   */
  const widgetRows = Object.values(WIDGET_REGISTRY).map((def, index) => ({
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

  const { error: widgetError } = await db
    .from('widget_definitions')
    .upsert(widgetRows, { onConflict: 'id' })
  if (widgetError) throw new Error(`寫入 widget_definitions 失敗：${widgetError.message}`)
  console.log(`✓ widget_definitions：${widgetRows.length} 個 widget`)

  console.log('')
  console.log('Seed 完成。')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
