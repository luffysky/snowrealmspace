import type { Db } from '@snowrealm/db/server'
import {
  buildFontFaceCss,
  compileFontVars,
  type ResolvedFont,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'
import { storage } from '@snowrealm/storage'

/**
 * 在 SSR 階段解析主題用到的字體，產生 `@font-face` 與 `--sr-font-*`。
 *
 * ## 為什麼在伺服器端做
 *
 * 客戶端載入的話，首屏一定會先用系統字體畫一次再換成使用者選的字體 ——
 * 中文字體的字寬與系統字體差很多，那一下跳動非常明顯。
 * SSR 注入讓第一次繪製就是對的字體堆疊。
 *
 * 分片檔仍然是瀏覽器按 unicode-range 自己下載，這裡只給規則。
 *
 * ## 失敗時的行為
 *
 * 字體讀不到就回 null，頁面用 CSS 檔裡的預設堆疊 ——
 * 字體是裝飾，不該讓它擋住整頁渲染。但**要 log**，
 * 否則「使用者選的字體沒生效」會變成一個沒人發現的靜默失敗。
 */

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60

type SubsetRecord = { file: string; unicodeRange: string; bytes: number; critical: boolean }
type FileManifest = Record<string, { subsets: SubsetRecord[] }>

export type ServerFontResult = {
  /** 要塞進 <style> 的 CSS：@font-face 規則 + :root 的 font-family 變數 */
  css: string
  /** 要加 <link rel=preload> 的 URL */
  preload: string[]
}

export async function resolveThemeFonts(
  db: Db,
  definition: ThemeDefinition,
): Promise<ServerFontResult | null> {
  const ids = [
    definition.typography.headingFontId,
    definition.typography.bodyFontId,
    definition.typography.uiFontId,
    definition.typography.monoFontId,
  ].filter((id): id is string => Boolean(id))

  if (ids.length === 0) return null

  // fontId 可能是 slug（預設主題）也可能是 uuid（使用者存的主題）。
  // 兩種都試，否則預設主題的字體永遠解析不到。
  const uuids = ids.filter(isUuid)
  const slugs = ids.filter((id) => !isUuid(id))

  const { data, error } = await db
    .from('fonts')
    .select(
      'id, slug, family, weights, file_manifest, fallback_stack',
    )
    .eq('enabled', true)
    .or(
      [
        uuids.length > 0 ? `id.in.(${uuids.join(',')})` : null,
        slugs.length > 0 ? `slug.in.(${slugs.join(',')})` : null,
      ]
        .filter(Boolean)
        .join(','),
    )

  if (error) {
    console.error('[server-fonts] 讀取字體失敗', error.message)
    return null
  }
  if (!data || data.length === 0) return null

  const byKey = new Map<string, (typeof data)[number]>()
  for (const font of data) {
    byKey.set(font.id, font)
    byKey.set(font.slug, font)
  }

  const heading = byKey.get(definition.typography.headingFontId)
  const body = byKey.get(definition.typography.bodyFontId)
  const ui = byKey.get(definition.typography.uiFontId)

  // 三個角色缺任何一個就整組不套用 —— 只套一半會讓標題是新字體、
  // 內文是系統字體，比全部都用預設更難看。
  if (!heading || !body || !ui) {
    console.warn('[server-fonts] 主題引用的字體不存在，改用預設堆疊', {
      heading: definition.typography.headingFontId,
      body: definition.typography.bodyFontId,
      ui: definition.typography.uiFontId,
    })
    return null
  }

  const store = storage()
  const faces: string[] = []
  const preload: string[] = []

  for (const font of new Set([heading, body, ui])) {
    const manifest = (font.file_manifest ?? {}) as FileManifest

    for (const [weight, entry] of Object.entries(manifest)) {
      const subsets = await Promise.all(
        (entry.subsets ?? []).map(async (subset) => ({
          url: await store.createDownloadUrl({
            key: subset.file,
            expiresInSeconds: SIGNED_URL_TTL_SECONDS,
          }),
          unicodeRange: subset.unicodeRange,
          critical: subset.critical,
        })),
      )

      faces.push(
        buildFontFaceCss({
          family: font.family,
          weight: Number(weight),
          style: 'normal',
          display: 'swap',
          subsets: subsets.map((s) => ({ url: s.url, unicodeRange: s.unicodeRange })),
        }),
      )

      // 只預載內文字重的 critical 片。全部字重都預載會下載一堆用不到的。
      if (weight === '400') {
        preload.push(...subsets.filter((s) => s.critical).map((s) => s.url))
      }
    }
  }

  const vars = compileFontVars({
    heading: toResolved(heading),
    body: toResolved(body),
    ui: toResolved(ui),
  })

  const varsCss = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`

  return { css: [...faces, varsCss].join('\n'), preload }
}

function toResolved(row: {
  slug: string
  family: string
  weights: number[]
  fallback_stack: string | null
}): ResolvedFont {
  return {
    slug: row.slug,
    family: row.family,
    fallbackStack: row.fallback_stack ?? '',
    weights: row.weights,
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
