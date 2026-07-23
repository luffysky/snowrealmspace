import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** ADR-020：Alpha 只做檔案匯出匯入，無線上分享。 */
export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data: theme } = await ctx.db
      .from('themes')
      .select('id, name, definition')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!theme) return fail('NOT_FOUND', '找不到這個主題。')

    const definition = theme.definition as { typography?: Record<string, string> }
    const fontIds = [
      definition.typography?.['headingFontId'],
      definition.typography?.['bodyFontId'],
      definition.typography?.['uiFontId'],
      definition.typography?.['monoFontId'],
    ].filter((v): v is string => Boolean(v))

    const { data: fonts } = await ctx.db
      .from('fonts')
      .select('id, family, slug')
      .in('slug', fontIds)

    const payload = {
      format: 'snowrealm-theme' as const,
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      name: theme.name,
      definition: theme.definition,
      // 匯入端用 slug 比對本地字體；找不到時降級為同分類預設
      fontRefs: (fonts ?? []).map((f) => ({ id: f.id, family: f.family, slug: f.slug })),
    }

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': contentDisposition(`${theme.name}.snowrealm.json`),
      },
    })
  },
)

/**
 * RFC 5987 的 Content-Disposition。
 *
 * HTTP header 只能是 latin-1（ByteString）。主題名稱幾乎都含中文，
 * 直接放進 header 會拋 "Cannot convert argument to a ByteString"。
 *
 * 正解是雙軌：ASCII 的 filename 當 fallback，
 * 另給 filename* 用 UTF-8 百分號編碼承載真實名稱。
 */
function contentDisposition(filename: string): string {
  // ASCII fallback：非 ASCII 字元換成底線，避免舊瀏覽器拿到亂碼
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
