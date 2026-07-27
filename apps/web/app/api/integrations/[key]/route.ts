import type { NextRequest } from 'next/server'
import { getActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { ok, fail, handler } from '@/lib/api/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 中斷連線（04-api-contract.md §7）。key = connectionId。
 *
 * 空間擁有者限定。`?purgeData=true` 刪除該連線的派生 design_files（snapshots 隨 FK cascade）；
 * `purgeData=false`（預設）則保留但把 design_files 標記 sync_status='paused'、連線標 revoked。
 * UI 必須讓使用者明確選擇（§7），不預設刪除。
 *
 * 註：共用的 asset 位元組不在此刪除——assets 是去重的共享位元組，清除走 asset 刪除／GC 路徑
 * （含引用檢查與 R2 位元組移除），不在中斷連線時順手刪，以免誤刪仍被其他作品引用的檔案。
 */
export const DELETE = handler(async (request: NextRequest, { params }: { params: Promise<{ key: string }> }) => {
  const { key: connectionId } = await params

  const user = await getUser()
  if (!user) return fail('UNAUTHENTICATED', '請先登入。')
  const active = await getActiveSpace()
  if (!active) return fail('FORBIDDEN', '找不到作用中的空間。')
  if (active.role !== 'owner') return fail('FORBIDDEN', '只有空間擁有者能中斷外部連線。')

  const db = await getDb()
  const { data: conn } = await db
    .from('design_connections')
    .select('id, provider')
    .eq('id', connectionId)
    .eq('space_id', active.space.id)
    .maybeSingle()
  if (!conn) return fail('NOT_FOUND', '找不到這條連線。')

  const purge = new URL(request.url).searchParams.get('purgeData') === 'true'

  if (purge) {
    // design_files 刪除 → design_snapshots 隨 on delete cascade 一併清除
    const { error: filesErr } = await db.from('design_files').delete().eq('connection_id', connectionId)
    if (filesErr) {
      console.error('[integrations/disconnect] 刪除 design_files 失敗', filesErr.message)
      return fail('INTERNAL', '刪除派生資料時發生問題。')
    }
    const { error: connErr } = await db.from('design_connections').delete().eq('id', connectionId)
    if (connErr) return fail('INTERNAL', '刪除連線時發生問題。')
    return ok({ id: connectionId, purged: true })
  }

  // 保留派生資料：標記暫停，連線標 revoked
  await db.from('design_files').update({ sync_status: 'paused' } as never).eq('connection_id', connectionId)
  const { error } = await db
    .from('design_connections')
    .update({ status: 'revoked' } as never)
    .eq('id', connectionId)
  if (error) return fail('INTERNAL', '中斷連線時發生問題。')
  return ok({ id: connectionId, purged: false })
})
