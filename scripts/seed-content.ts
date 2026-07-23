import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { parse } from 'yaml'
import {
  quoteSchema,
  promptSchema,
  greetingsFileSchema,
  surpriseSchema,
  chainLinkSchema,
  GREETING_SLOTS,
} from '@snowrealm/validation'
import { createAdminClient } from '@snowrealm/db/server'

config({ path: '.env.local' })
config({ path: '.env' })

/**
 * 把 content/ 的 YAML 灌進 content_items 表。
 *
 * 內容池是全站公開參考資料（像 fonts）—— 所有 space 共用同一份，
 * 不屬於任何租戶。走 service role，冪等（upsert，可重跑）。
 *
 * 用法：pnpm seed:content
 *
 * ⚠️ 先跑過 check:content 確保內容合法，再灌 DB。
 */

const ROOT = join(import.meta.dirname, '..')
const CONTENT = join(ROOT, 'content')

type Row = {
  content_id: string
  kind: string
  text: string
  label?: string | null
  tags?: string[]
  weight?: number
  estimated_minutes?: number | null
  min_days_since_signup?: number | null
  requires_tag?: string | null
  cooldown_days?: number | null
  greeting_slot?: string | null
  requires_background_changed?: boolean
  rarity?: string | null
  chain_index?: number | null
  available_from?: string | null
}

async function main() {
  const rows: Row[] = []

  // ── quotes ──
  for (const raw of await loadDir('daily/quotes')) {
    const q = quoteSchema.parse(raw)
    rows.push({
      content_id: q.id,
      kind: 'quote',
      text: q.text,
      tags: q.tags,
      weight: q.weight ?? 1,
      min_days_since_signup: q.minDaysSinceSignup ?? null,
      requires_tag: q.requiresTag ?? null,
      cooldown_days: q.cooldownDays ?? null,
    })
  }

  // ── prompts ──
  for (const raw of await loadDir('daily/prompts')) {
    const p = promptSchema.parse(raw)
    rows.push({
      content_id: p.id,
      kind: 'prompt',
      text: p.text,
      tags: p.tags,
      weight: p.weight ?? 1,
      estimated_minutes: p.estimatedMinutes,
      min_days_since_signup: p.minDaysSinceSignup ?? null,
      requires_tag: p.requiresTag ?? null,
      cooldown_days: p.cooldownDays ?? null,
    })
  }

  // ── greetings（依時段）──
  for (const doc of await loadDocs('daily', /greetings.*\.ya?ml$/)) {
    const parsed = greetingsFileSchema.parse(doc)
    for (const slot of GREETING_SLOTS) {
      for (const g of parsed[slot]) {
        rows.push({
          content_id: g.id,
          kind: 'greeting',
          text: g.text,
          weight: g.weight ?? 1,
          greeting_slot: slot,
          requires_background_changed: g.requiresBackgroundChanged ?? false,
        })
      }
    }
  }

  // ── surprises ──
  for (const raw of await loadDir('surprise')) {
    const s = surpriseSchema.parse(raw)
    // rarity 由檔名/id 推斷：id 形如 s-<rarity>-NNN
    const rarity = s.id.split('-')[1] ?? 'common'
    rows.push({
      content_id: s.id,
      kind: 'surprise',
      text: s.text,
      label: s.label,
      tags: s.tags,
      weight: s.weight ?? 1,
      rarity,
      min_days_since_signup: s.minDaysSinceSignup ?? null,
    })
  }

  // ── chain ──
  for (const raw of await loadDir('chain')) {
    const c = chainLinkSchema.parse(raw)
    rows.push({
      content_id: c.id,
      kind: 'chain',
      text: c.text,
      label: c.title,
      chain_index: c.chainIndex,
      available_from: c.availableFrom,
    })
  }

  // 正規化：每列補齊全部欄位，避免批次中不同列的鍵不一致
  // 讓 supabase-js 對缺鍵的列送出 null（違反 not-null 約束）。
  const normalized = rows.map((r) => ({
    content_id: r.content_id,
    kind: r.kind,
    text: r.text,
    label: r.label ?? null,
    tags: r.tags ?? [],
    weight: r.weight ?? 1,
    estimated_minutes: r.estimated_minutes ?? null,
    min_days_since_signup: r.min_days_since_signup ?? null,
    requires_tag: r.requires_tag ?? null,
    cooldown_days: r.cooldown_days ?? null,
    greeting_slot: r.greeting_slot ?? null,
    requires_background_changed: r.requires_background_changed ?? false,
    rarity: r.rarity ?? null,
    chain_index: r.chain_index ?? null,
    available_from: r.available_from ?? null,
    enabled: true,
  }))

  const db = createAdminClient()

  // 分批 upsert，避免單次 payload 過大
  const BATCH = 500
  let done = 0
  for (let i = 0; i < normalized.length; i += BATCH) {
    const batch = normalized.slice(i, i + BATCH)
    const { error } = await db.from('content_items').upsert(batch as never, {
      onConflict: 'content_id',
    })
    if (error) {
      console.error(`✗ 批次 ${i}-${i + batch.length} 失敗：${error.message}`)
      process.exit(1)
    }
    done += batch.length
    process.stdout.write(`\r灌入 ${done}/${rows.length}`)
  }

  console.log('')
  const byKind = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1
    return acc
  }, {})
  console.log('content_items 統計：')
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v}`)
  console.log(`\n✓ 共 ${rows.length} 則內容灌入 content_items。`)
}

async function loadDir(rel: string): Promise<unknown[]> {
  const dir = join(CONTENT, rel)
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f))
  const out: unknown[] = []
  for (const f of files) {
    const doc = parse(await readFile(join(dir, f), 'utf8')) as unknown
    if (Array.isArray(doc)) out.push(...doc)
  }
  return out
}

async function loadDocs(rel: string, pattern: RegExp): Promise<unknown[]> {
  const dir = join(CONTENT, rel)
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter((f) => pattern.test(f))
  return Promise.all(files.map(async (f) => parse(await readFile(join(dir, f), 'utf8'))))
}

await main()
