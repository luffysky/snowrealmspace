import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { storage } from '@snowrealm/storage'

export const dynamic = 'force-dynamic'

/**
 * 可用字體清單與分片 manifest。
 *
 * 字體是公開參考資料（`fonts` 表的 RLS 是「所有人可讀啟用中的」），
 * 但這裡仍用受 RLS 約束的 client —— 沒有理由為了讀公開資料
 * 就拿出 service role。
 *
 * ## 為什麼要在這裡簽 URL
 *
 * R2 bucket 是 private（ADR-005：不開公開存取）。
 * 分片路徑存在 `file_manifest` 裡是物件鍵，不是可直接取用的網址。
 * 簽名有效期取長（24 小時）—— 字體檔內容不會變，
 * 而每次換主題都重簽 1000 個 URL 是沒有意義的開銷。
 */

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60

type SubsetRecord = { file: string; unicodeRange: string; bytes: number; critical: boolean }
type FileManifest = Record<string, { subsets: SubsetRecord[] }>

export async function GET() {
  const db = await getDb()

  const { data: fonts, error } = await db
    .from('fonts')
    // 必須是單一字面量：supabase-js 從這個字串推導回傳型別，
    // 用 + 接起來會退化成 GenericStringError，錯誤訊息完全指不到原因。
    .select(
      'id, slug, family, category, supported_languages, weights, preview_text, file_manifest, fallback_stack, license_name, license_url',
    )
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: { message: '讀取字體失敗' } }, { status: 500 })
  }

  const store = storage()

  const withUrls = await Promise.all(
    (fonts ?? []).map(async (font) => {
      const manifest = (font.file_manifest ?? {}) as FileManifest
      const files: Record<string, { file: string; unicodeRange: string; critical: boolean }[]> = {}

      let firstScreenBytes = 0

      for (const [weight, entry] of Object.entries(manifest)) {
        files[weight] = await Promise.all(
          (entry.subsets ?? []).map(async (subset) => ({
            file: await store.createDownloadUrl({
              key: subset.file,
              expiresInSeconds: SIGNED_URL_TTL_SECONDS,
            }),
            unicodeRange: subset.unicodeRange,
            critical: subset.critical,
          })),
        )

        // 首屏成本以 400 字重為準，見 unicode-ranges.ts 的說明
        if (weight === '400') {
          firstScreenBytes = (entry.subsets ?? [])
            .filter((s) => s.critical)
            .reduce((n, s) => n + s.bytes, 0)
        }
      }

      return {
        id: font.id,
        slug: font.slug,
        family: font.family,
        category: font.category,
        scripts: font.supported_languages,
        weights: font.weights,
        previewText: font.preview_text,
        fallbackStack: font.fallback_stack ?? '',
        license: { name: font.license_name, url: font.license_url },
        // 讓 UI 能誠實顯示「這套要多載多少」
        firstScreenBytes,
        files,
      }
    }),
  )

  const { data: pairs } = await db
    .from('font_pairs')
    .select('id, name, heading_font_id, body_font_id, ui_font_id, mood_tags')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  return NextResponse.json({
    data: {
      fonts: withUrls,
      pairs: (pairs ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        headingFontId: p.heading_font_id,
        bodyFontId: p.body_font_id,
        uiFontId: p.ui_font_id,
        moodTags: p.mood_tags,
      })),
    },
  })
}
