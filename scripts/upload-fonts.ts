import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { storage } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { ALL_FONTS, FONT_PAIRINGS, fontBySlug } from '@snowrealm/shared-types'
import type { FontManifest } from './build-fonts.js'

config({ path: '.env.local' })
config({ path: '.env' })

/**
 * 把 assets/fonts-build/ 的分片上傳到 R2，並寫入 `fonts` / `font_pairs` 表。
 *
 * 用法：pnpm tsx scripts/upload-fonts.ts
 *
 * 冪等：重跑會覆蓋同名物件並 upsert 資料列。
 * 字體是公開參考資料（不屬於任何 space），所以走 service role。
 *
 * ## 為什麼路徑不含 space_id
 *
 * ADR-006 說授權一律用 space_id，但那是針對**使用者內容**。
 * 字體是全站共用的參考資料，每個 space 存一份等於把 250 MB 乘上使用者數。
 * `fonts` 表的 RLS 是「所有人可讀啟用中的」，沒有租戶維度。
 */

const ROOT = join(import.meta.dirname, '..')
const BUILD_DIR = join(ROOT, 'assets', 'fonts-build')
const KEY_PREFIX = 'public/fonts'

async function main() {
  const manifestPath = join(BUILD_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error('找不到 manifest.json。先跑：pnpm fonts:build')
    process.exit(1)
  }

  const manifests = JSON.parse(await readFile(manifestPath, 'utf8')) as FontManifest[]
  if (manifests.length === 0) {
    console.error('manifest 是空的。')
    process.exit(1)
  }

  const store = storage()
  const db = createAdminClient()

  let uploaded = 0
  let bytes = 0

  for (const manifest of manifests) {
    const entry = fontBySlug(manifest.slug)
    if (!entry) {
      console.error(`✗ ${manifest.slug} 不在目錄裡，略過`)
      continue
    }

    const dir = join(BUILD_DIR, manifest.slug)

    // OFL 要求授權全文隨字體散布 —— 授權檔要先上傳成功，
    // 才輪得到字體本身。順序反過來的話中途失敗會留下無授權的字體檔。
    const licenseKey = `${KEY_PREFIX}/${manifest.slug}/LICENSE.txt`
    await store.put({
      key: licenseKey,
      body: await readFile(join(dir, 'LICENSE.txt')),
      contentType: 'text/plain; charset=utf-8',
      cacheControl: 'public, max-age=31536000, immutable',
    })

    const fileManifest: Record<string, { subsets: SubsetRecord[] }> = {}

    for (const weight of manifest.weights) {
      const subsets: SubsetRecord[] = []

      for (const slice of weight.slices) {
        const key = `${KEY_PREFIX}/${manifest.slug}/${slice.file}`
        await store.put({
          key,
          body: await readFile(join(dir, slice.file)),
          contentType: 'font/woff2',
          // 檔名含 slug + 字重 + 分片 id，內容變了檔名也會變 →
          // 可以安全地 immutable 快取一年
          cacheControl: 'public, max-age=31536000, immutable',
        })
        subsets.push({
          file: key,
          unicodeRange: slice.unicodeRange,
          bytes: slice.bytes,
          critical: slice.critical,
        })
        uploaded++
        bytes += slice.bytes
      }

      fileManifest[String(weight.weight)] = { subsets }
    }

    const { error } = await db.from('fonts').upsert(
      {
        family: entry.family,
        slug: entry.slug,
        category: entry.category,
        supported_languages: entry.scripts,
        weights: manifest.weights.map((w) => w.weight),
        styles: ['normal'],
        preview_text: entry.previewText,
        file_manifest: fileManifest,
        subset_strategy: manifest.subsetStrategy,
        license_name: entry.license,
        license_url: entry.licenseUrl,
        license_file_key: licenseKey,
        attribution_required: false,
        fallback_stack: entry.fallbackStack,
        enabled: true,
        sort_order: ALL_FONTS.findIndex((f) => f.slug === entry.slug),
      } as never,
      { onConflict: 'slug' },
    )

    if (error) {
      console.error(`✗ ${manifest.slug} 寫入 fonts 表失敗：${error.message}`)
      process.exit(1)
    }

    console.log(`✓ ${manifest.slug} — ${manifest.weights.length} 字重上傳完成`)
  }

  await seedPairs(db)

  console.log('')
  console.log(`共上傳 ${uploaded} 個分片，${(bytes / 1024 / 1024).toFixed(1)} MB`)
  console.log('')
}

type SubsetRecord = {
  file: string
  unicodeRange: string
  bytes: number
  critical: boolean
}

async function seedPairs(db: ReturnType<typeof createAdminClient>): Promise<void> {
  const { data: rows } = await db.from('fonts').select('id, slug')
  const idBySlug = new Map((rows ?? []).map((r) => [r.slug, r.id]))

  let inserted = 0
  for (const [index, pair] of FONT_PAIRINGS.entries()) {
    const heading = idBySlug.get(pair.heading)
    const body = idBySlug.get(pair.body)
    const ui = idBySlug.get(pair.ui)

    // 配對中有字體還沒上傳（例如台北黑體要人工下載）就跳過，
    // 而不是寫一筆指向不存在字體的配對 —— 那在 UI 上會是個壞掉的選項。
    if (!heading || !body || !ui) {
      console.log(`· 配對「${pair.name}」缺字體，略過`)
      continue
    }

    const { error } = await db.from('font_pairs').upsert(
      {
        name: pair.name,
        heading_font_id: heading,
        body_font_id: body,
        ui_font_id: ui,
        mood_tags: pair.moodTags,
        sort_order: index,
        enabled: true,
      } as never,
      { onConflict: 'name' },
    )
    if (error) {
      console.error(`✗ 配對「${pair.name}」寫入失敗：${error.message}`)
      continue
    }
    inserted++
  }

  console.log(`✓ ${inserted} 組字體配對`)
}

await main()
