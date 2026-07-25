import type { NextRequest } from 'next/server'
import { zipSync, strToU8 } from 'fflate'
import { getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** assets 中繼資料 → 好讀的 CSV（不含位元組）。 */
function assetsCsv(rows: unknown): string {
  const list = Array.isArray(rows) ? rows : []
  const header = 'id,original_filename,kind,mime_type,bytes,created_at'
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = list.map((r) => {
    const a = r as Record<string, unknown>
    return [a.id, a.original_filename, a.kind, a.mime_type, a.bytes, a.created_at].map(esc).join(',')
  })
  return [header, ...lines].join('\n')
}

/**
 * 帳號資料匯出（10-acceptance.md 隱私與刪除）。
 *
 * 把這個使用者空間裡的資料匯出成一份可攜、可讀、可再匯入的 JSON。
 * 走 RLS（getDb）：只會拿到自己空間的資料。
 *
 * 不含 asset 的位元組（那在 R2，可到 Library 逐一下載）——這裡匯出的是
 * 「資料與設定」：主題、背景、專案、作品、時間軸、記憶、回顧、通知、檔案清單…
 * ADR-005：位元組只存 assets/asset_renditions，匯出用清單 + 檔名而非塞進 JSON。
 */
const TABLES = [
  'space_settings',
  'themes',
  'background_items',
  'background_playlists',
  'projects',
  'design_files',
  'design_snapshots',
  'timeline_events',
  'memories',
  'insights',
  'notifications',
  'surprises',
  'daily_items',
  'assets',
] as const

export const GET = handler(async (request: NextRequest) => {
  const user = await getUser()
  if (!user) return fail('UNAUTHENTICATED', '請先登入。')

  const asZip = new URL(request.url).searchParams.get('format') === 'zip'

  const db = await getDb()

  // 目前活躍（未刪除）的 space
  const { data: membership } = await db
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership) return fail('NOT_FOUND', '找不到你的空間。')
  const spaceId = membership.space_id

  const { data: space } = await db
    .from('spaces')
    .select('*')
    .eq('id', spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!space) return fail('NOT_FOUND', '找不到你的空間，或它已在刪除中。')

  const data: Record<string, unknown> = {}
  for (const table of TABLES) {
    // RLS 只回自己空間的列；個別表查詢失敗不該讓整份匯出失敗，記錄後跳過
    const { data: rows, error } = await db
      .from(table)
      .select('*')
      .eq('space_id', spaceId)
      .limit(5000)
    if (error) {
      console.error(`[account-export] ${table} 匯出失敗`, error.message)
      data[table] = { error: '此類資料匯出失敗，其餘不受影響。' }
      continue
    }
    data[table] = rows ?? []
  }

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      schema: 'snowrealm-space/account-export@1',
      spaceId,
      note: 'assets 為檔案的中繼資料清單，實際檔案位元組請到 Library 下載。',
    },
    space,
    ...data,
  }

  const slug = typeof space.slug === 'string' ? space.slug : 'space'
  const stamp = new Date().toISOString().slice(0, 10)
  const jsonStr = JSON.stringify(payload, null, 2)

  if (asZip) {
    const readme =
      `SnowRealm Space 帳號匯出\n匯出時間：${payload.meta.exportedAt}\n\n` +
      `data.json —— 全部資料與設定（可再匯入）。\n` +
      `assets.csv —— 檔案清單（中繼資料）。實際檔案位元組請到 Library 逐一下載；\n` +
      `依 ADR-005，位元組只存在 assets 儲存層，不放進這份匯出。\n`
    const zipped = zipSync(
      {
        'data.json': strToU8(jsonStr),
        'assets.csv': strToU8(assetsCsv(data['assets'])),
        'README.txt': strToU8(readme),
      },
      { level: 6 },
    )
    // fflate 回傳的是 Node ArrayBuffer 檢視；轉成獨立 ArrayBuffer 供 Response 使用
    const body = zipped.slice().buffer
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="snowrealm-export-${slug}-${stamp}.zip"`,
        'cache-control': 'no-store',
      },
    })
  }

  return new Response(jsonStr, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="snowrealm-export-${slug}-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  })
})
