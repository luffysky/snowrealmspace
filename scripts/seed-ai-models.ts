/**
 * Seed ai_models + ai_usage_models（初始候選鏈）。見 12-ai-model-routing.md §2.1、§6。
 *
 * 冪等（upsert）。上線後由後台在 DB 維護；這裡是起點。
 * anthropic 標付費（含成本），其餘免費 provider 成本 0。
 * 實際模型名可能退役 —— 屆時在 DB 更新，不必改程式。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { DEFAULT_CANDIDATES, AI_USAGE_KEYS, splitProviderPrefix } from '@snowrealm/ai-core'

// 付費模型的粗略成本（USD / 1M token）。免費 provider 一律 0。
const PAID_COST: Record<string, { input: number; output: number; vision?: boolean }> = {
  'claude-opus-4-8': { input: 5, output: 25, vision: true },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, vision: true },
}

const VISION_HINT = /vision|flash|gemini|opus|haiku/i
const TOOLS_HINT = /claude|gpt|llama-3\.3|mistral|gemini/i

async function main() {
  const admin = createAdminClient()

  // 從候選鏈收集所有出現過的 model
  const seen = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const key of AI_USAGE_KEYS) {
    for (const c of DEFAULT_CANDIDATES[key]) {
      if (seen.has(c.model)) continue
      seen.add(c.model)
      const { provider, model } = splitProviderPrefix(c.model)
      if (!provider) continue
      const paid = PAID_COST[model]
      rows.push({
        provider,
        model_name: model,
        display_name: model,
        is_free: !paid,
        cost_input_per_1m: paid?.input ?? 0,
        cost_output_per_1m: paid?.output ?? 0,
        supports_vision: paid?.vision ?? VISION_HINT.test(model),
        supports_tools: TOOLS_HINT.test(model),
        supports_streaming: true,
        is_active: true,
      })
    }
  }

  const { error: mErr } = await admin
    .from('ai_models')
    .upsert(rows as never, { onConflict: 'provider,model_name' })
  if (mErr) throw new Error(`seed ai_models 失敗：${mErr.message}`)
  console.log(`✓ ai_models：${rows.length} 個模型`)

  // ai_usage_models：每個 usage key 的候選鏈（DB 為準；程式的 DEFAULT 是離線 fallback）
  const usageRows = AI_USAGE_KEYS.map((key) => ({
    usage_key: key,
    model_name: DEFAULT_CANDIDATES[key][0]!.model,
    candidates: DEFAULT_CANDIDATES[key] as never,
    enabled: true,
  }))
  const { error: uErr } = await admin
    .from('ai_usage_models')
    .upsert(usageRows as never, { onConflict: 'usage_key' })
  if (uErr) throw new Error(`seed ai_usage_models 失敗：${uErr.message}`)
  console.log(`✓ ai_usage_models：${usageRows.length} 個用途`)

  console.log('\n✅ AI 模型 seed 完成')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
