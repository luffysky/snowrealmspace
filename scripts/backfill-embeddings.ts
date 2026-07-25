/**
 * 為既有的「已批准、非 restricted」記憶補上語意向量（memories.embedding）。
 *
 * 何時用：接上 embedding 功能後、或換 embedding 模型後，把歷史記憶一次向量化，
 * 讓語意檢索（match_memories / Agent context RAG）能涵蓋舊資料。
 * 新記憶在 approve / 使用者新增時已即時向量化，不需要這支。
 *
 * 走 DEFAULT_CANDIDATES.embedding 的順序（openai 768 → google 004），
 * 依環境變數金鑰挑第一個可用的 provider。缺金鑰就直接退出（誠實失敗，不空跑）。
 *
 *   pnpm tsx scripts/backfill-embeddings.ts            # 全部 space
 *   pnpm tsx scripts/backfill-embeddings.ts <spaceId>  # 限定 space
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import postgres from 'postgres'
import {
  embedText,
  toVectorLiteral,
  DEFAULT_CANDIDATES,
  splitProviderPrefix,
  providerFromModel,
  envKeyName,
  type ProviderId,
} from '../packages/ai-core/src/index.js'

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })

/** 依候選鏈挑第一個「環境有金鑰」的 embedding provider。 */
function pickEmbedder(): { provider: ProviderId; model: string; apiKey: string } | null {
  for (const c of DEFAULT_CANDIDATES.embedding) {
    const sp = splitProviderPrefix(c.model)
    const provider = (sp.provider ?? providerFromModel(c.model)) as ProviderId
    const apiKey = process.env[envKeyName(provider)]
    if (apiKey) return { provider, model: sp.model, apiKey }
  }
  return null
}

async function main(): Promise<void> {
  const spaceId = process.argv[2]
  const embedder = pickEmbedder()
  if (!embedder) {
    console.error('沒有可用的 embedding 金鑰（需要 OPENAI_API_KEY 或 GOOGLE_API_KEY）。')
    process.exit(1)
  }
  console.log(`使用 ${embedder.provider}:${embedder.model} 向量化`)

  const rows = spaceId
    ? await sql`select id, content from memories where space_id = ${spaceId} and approved and deleted_at is null and sensitivity <> 'restricted' and embedding is null`
    : await sql`select id, content from memories where approved and deleted_at is null and sensitivity <> 'restricted' and embedding is null`

  console.log(`待處理：${rows.length} 則`)
  let done = 0
  let failed = 0
  for (const m of rows) {
    if (!m.content?.trim()) continue
    try {
      const { vector } = await embedText({
        provider: embedder.provider,
        model: embedder.model,
        apiKey: embedder.apiKey,
        input: m.content,
      })
      await sql`update memories set embedding = ${toVectorLiteral(vector)}::vector(768) where id = ${m.id}`
      done++
    } catch (err) {
      failed++
      console.error(`  失敗 ${m.id}:`, (err as Error).message)
    }
  }
  console.log(`完成：${done} 則已向量化${failed ? `，${failed} 則失敗` : ''}。`)
  await sql.end()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
