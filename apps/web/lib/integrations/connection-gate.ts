import { getActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { isEnabled } from '@/lib/flags'
import { fail } from '@/lib/api/respond'
import type { ApiContext } from '@/lib/api/context'
import { PROVIDER_FLAG, isProviderKey, type ProviderKey } from '@/lib/integrations/providers'
import type { ConnectionRow } from '@/lib/integrations/sync'

/**
 * 連線層級操作（列檔 / 同步）的共用閘門：
 * 登入 → 作用中空間的擁有者 → 連線屬於本 space → 該 provider 的 flag 開啟（ADR-018，關則 404）。
 * connectionId 走 getDb 受 RLS（owner 才讀得到含 token 的連線列）。
 */
export type ConnectionGate =
  | { ok: true; ctx: ApiContext; connection: ConnectionRow; provider: ProviderKey }
  | { ok: false; res: Response }

export async function gateOwnerConnection(connectionId: string): Promise<ConnectionGate> {
  const user = await getUser()
  if (!user) return { ok: false, res: fail('UNAUTHENTICATED', '請先登入。') }
  const active = await getActiveSpace()
  if (!active) return { ok: false, res: fail('FORBIDDEN', '找不到作用中的空間。') }
  if (active.role !== 'owner') return { ok: false, res: fail('FORBIDDEN', '只有空間擁有者能同步外部設計工具。') }

  const db = await getDb()
  const { data: conn } = await db
    .from('design_connections')
    .select('id, provider, access_token_encrypted, refresh_token_encrypted, expires_at, status')
    .eq('id', connectionId)
    .eq('space_id', active.space.id)
    .maybeSingle()
  if (!conn) return { ok: false, res: fail('NOT_FOUND', '找不到這條連線。') }
  if (!isProviderKey(conn.provider)) return { ok: false, res: fail('UNPROCESSABLE', '不支援的 provider。') }
  if (conn.status === 'revoked') return { ok: false, res: fail('UNPROCESSABLE', '這條連線已中斷，請重新連接。') }

  // flag 關 → 404（ADR-018：假關閉不行）
  if (!(await isEnabled(PROVIDER_FLAG[conn.provider], active.space.id))) {
    return { ok: false, res: fail('NOT_FOUND', '這個整合尚未啟用。') }
  }

  const ctx: ApiContext = { db, userId: user.id, spaceId: active.space.id, role: active.role }
  return { ok: true, ctx, connection: conn, provider: conn.provider }
}
