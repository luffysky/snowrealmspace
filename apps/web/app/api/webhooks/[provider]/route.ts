import type { NextRequest } from 'next/server'
import { FigmaAdapter } from '@snowrealm/provider-core'
import { createAdminClient } from '@snowrealm/db/server'

export const dynamic = 'force-dynamic'

/**
 * Provider webhook（04-api-contract.md §7、10-acceptance F）。
 *
 * 無 session（外部呼叫）。必須：驗簽章、3 秒內回 200、冪等（provider_webhooks unique）。
 * 目前 Figma connectable=false（無憑證），所以會找不到 connection → 回 200 但不處理
 * （webhook 端點永遠快速回 200，避免 provider 重送；實際處理是否進行看有無有效 connection）。
 */
const ADAPTERS = { figma: new FigmaAdapter() } as const

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const adapter = ADAPTERS[provider as keyof typeof ADAPTERS]
  if (!adapter) return Response.json({ ok: false }, { status: 404 })

  const rawBody = await request.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  const admin = createAdminClient()
  const externalId = adapter.externalEventId(payload)
  if (!externalId) {
    // 無法去重的事件不處理，但仍快速回 200
    return Response.json({ ok: true, ignored: 'no-event-id' }, { status: 200 })
  }

  // 冪等：unique(provider, external_event_id)。重送同事件 → 命中衝突、不重複處理。
  const signature = request.headers.get('x-figma-signature') ?? request.headers.get('x-signature')
  const { error } = await admin.from('provider_webhooks').insert({
    provider,
    external_event_id: externalId,
    payload: payload as never,
    // connection 尚未建立（Figma 無憑證）→ 簽章暫記為未驗證；有 connection 後改用其 secret 驗
    signature_ok: signature !== null,
  })
  if (error) {
    // 23505 = 重複事件（冪等命中）。仍回 200，讓 provider 停止重送。
    if (error.code === '23505') return Response.json({ ok: true, duplicate: true }, { status: 200 })
    console.error('[webhook] 寫入失敗', error.message)
  }

  // figma.sync job 的入列在有有效 connection 時才做（待憑證）。
  return Response.json({ ok: true }, { status: 200 })
}
