import type { NextRequest } from 'next/server'
import { assetListQuerySchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 游標式分頁（04-api-contract.md §0）。用 created_at + id 避免同秒資料被跳過。 */
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url')
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'createdAt' in parsed &&
      'id' in parsed &&
      typeof (parsed as { createdAt: unknown }).createdAt === 'string' &&
      typeof (parsed as { id: unknown }).id === 'string'
    ) {
      return parsed as { createdAt: string; id: string }
    }
    return null
  } catch {
    return null
  }
}

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = assetListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) return failValidation(parsed.error)
  const { kind, q, tag, favorite, archived, projectId, limit, cursor } = parsed.data

  // 依專案過濾：資產透過 design_files 連結到專案。先查該專案有哪些 asset。
  let projectAssetIds: string[] | null = null
  if (projectId) {
    const { data: files } = await ctx.db
      .from('design_files')
      .select('snapshots:design_snapshots(asset_id)')
      .eq('space_id', ctx.spaceId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
    projectAssetIds = Array.from(
      new Set(
        (files ?? []).flatMap((f) =>
          ((f as { snapshots?: { asset_id: string }[] }).snapshots ?? []).map((s) => s.asset_id),
        ),
      ),
    )
    if (projectAssetIds.length === 0) return ok([], { page: { hasMore: false, nextCursor: null } })
  }

  // 受 RLS 約束的 client：查詢結果本身就只含這個 space 的資料
  let query = ctx.db
    .from('assets')
    .select(
      'id, kind, mime_type, bytes, width, height, original_filename, status, is_favorite, archived_at, tags, created_at',
    )
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (kind) query = query.eq('kind', kind)
  if (q) query = query.ilike('original_filename', `%${q}%`)
  if (tag) query = query.contains('tags', [tag])
  if (favorite === true) query = query.eq('is_favorite', true)
  if (archived === 'exclude') query = query.is('archived_at', null)
  else if (archived === 'only') query = query.not('archived_at', 'is', null)
  if (projectAssetIds) query = query.in('id', projectAssetIds)

  if (cursor) {
    const decoded = decodeCursor(cursor)
    if (!decoded) return fail('VALIDATION_FAILED', '分頁游標無效。')
    query = query.lt('created_at', decoded.createdAt)
  }

  const { data, error } = await query
  if (error) {
    console.error('[assets] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入檔案清單。')
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return ok(page, {
    page: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    },
  })
})
