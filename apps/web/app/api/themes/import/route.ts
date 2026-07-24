import type { NextRequest } from 'next/server'
import { themeImportSchema } from '@snowrealm/validation'
import { analyzeTheme, DEFAULT_THEME } from '@snowrealm/theme-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 匯入主題 JSON。
 *
 * ADR-020：匯入是**不可信輸入**。schema 驗證會擋下所有非純色值的內容
 * （url()、expression()、</style> 等），因此主題檔不會變成 CSS 注入管道。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = themeImportSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const payload = parsed.data

  // 字體降級：匯入檔引用的字體若本地沒有，換成同分類預設並告知使用者
  const definition = structuredClone(payload.definition)
  const requestedFonts = [
    definition.typography.headingFontId,
    definition.typography.bodyFontId,
    definition.typography.uiFontId,
    definition.typography.monoFontId,
  ].filter((v): v is string => Boolean(v))

  // fontId 可能是 slug（預設主題）或 uuid（Theme Studio/配對主題）。兩種都要查，
  // 否則自訂字體主題匯入時，UUID 對不到 slug → 字體被誤判「不存在」全換成預設。
  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  const uuids = requestedFonts.filter(isUuid)
  const slugs = requestedFonts.filter((v) => !isUuid(v))

  let fontQuery = ctx.db.from('fonts').select('id, slug').eq('enabled', true)
  const orParts = [
    uuids.length > 0 ? `id.in.(${uuids.join(',')})` : null,
    slugs.length > 0 ? `slug.in.(${slugs.join(',')})` : null,
  ].filter((v): v is string => Boolean(v))
  if (orParts.length > 0) fontQuery = fontQuery.or(orParts.join(','))
  const { data: availableFonts } = await fontQuery

  const available = new Set<string>()
  for (const f of availableFonts ?? []) {
    available.add(f.slug)
    if (f.id) available.add(f.id)
  }
  const substituted: { requested: string; usedInstead: string }[] = []

  const fallbacks: Record<string, string> = {
    headingFontId: DEFAULT_THEME.typography.headingFontId,
    bodyFontId: DEFAULT_THEME.typography.bodyFontId,
    uiFontId: DEFAULT_THEME.typography.uiFontId,
    monoFontId: DEFAULT_THEME.typography.monoFontId ?? 'jetbrains-mono',
  }

  for (const key of ['headingFontId', 'bodyFontId', 'uiFontId', 'monoFontId'] as const) {
    const requested = definition.typography[key]
    if (requested && !available.has(requested)) {
      const replacement = fallbacks[key]!
      definition.typography[key] = replacement
      substituted.push({ requested, usedInstead: replacement })
    }
  }

  const report = analyzeTheme(definition)

  const { data, error } = await ctx.db
    .from('themes')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      name: payload.name.slice(0, 80),
      definition: definition as never,
      source: 'imported',
      a11y_report: report as never,
    })
    .select('id, name, definition, a11y_report')
    .single()

  if (error || !data) {
    console.error('[themes/import] 失敗', error?.message)
    return fail('INTERNAL', '無法匯入主題。')
  }

  await emitEvent('theme.created', ctx.spaceId, ctx.userId, {
    themeId: data.id,
    name: data.name,
    source: 'imported',
  })

  return ok({ ...data, substitutedFonts: substituted }, undefined, 201)
})
