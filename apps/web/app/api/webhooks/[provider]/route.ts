import type { NextRequest } from 'next/server'
import { FigmaAdapter, CanvaAdapter, verifyFigmaPasscode } from '@snowrealm/provider-core'
import { createAdminClient } from '@snowrealm/db/server'
import { serverEnv } from '@snowrealm/shared-types'
import { enqueue } from '@/lib/api/queue'

export const dynamic = 'force-dynamic'

/**
 * 各 provider 的 webhook 驗證方式。每個 verifier 拿得到它需要的全部素材
 * （原始 body、簽章 header、已解析的 payload），各自取用：
 * - Figma＝比對 body 裡的 passcode（非 HMAC header），忽略 rawBody/signature。
 * - Canva＝HMAC over rawBody，用 header 帶來的簽章比對。
 */
type VerifyArgs = { rawBody: string; signature: string | null; payload: unknown }
const VERIFIERS: Record<string, (args: VerifyArgs) => boolean> = {
  figma: ({ payload }) => verifyFigmaPasscode(payload, serverEnv().FIGMA_WEBHOOK_SECRET ?? ''),
  canva: ({ rawBody, signature }) =>
    new CanvaAdapter().verifyWebhook(rawBody, signature, serverEnv().CANVA_WEBHOOK_SECRET ?? ''),
}

/**
 * Provider webhook（04-api-contract.md §7、10-acceptance F）。
 *
 * 無 session（外部呼叫）。必須：驗簽章、3 秒內回 200、冪等（provider_webhooks unique）。
 * 驗證通過且非重送時，找出事件影響的檔案，對每個「有效」的 design_files 列入列 design.sync
 * 背景 job（與手動同步路徑共用完全相同的入列契約）。未驗證或重送一律不入列，但仍快速回 200。
 */
const ADAPTERS = { figma: new FigmaAdapter(), canva: new CanvaAdapter() } as const

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

  // 驗證：Figma 比對 body 的 passcode；Canva 用 HMAC over rawBody（header 帶簽章）。
  // TODO(canva): confirm exact header name/scheme (unverified).
  const signature = request.headers.get('x-canva-signatures')
  const verifier = VERIFIERS[provider]
  const signatureOk = verifier ? verifier({ rawBody, signature, payload }) : false

  // 冪等：unique(provider, external_event_id)。重送同事件 → 命中衝突、不重複處理。
  const { error } = await admin.from('provider_webhooks').insert({
    provider,
    external_event_id: externalId,
    payload: payload as never,
    signature_ok: signatureOk,
  })
  const isDuplicate = error?.code === '23505' // 冪等命中（同事件重送）
  if (error && !isDuplicate) {
    console.error('[webhook] 寫入失敗', error.message)
  }

  // 只有「驗證通過」且「非重送」才觸發同步 —— 未驗證或重送都不入列。
  if (signatureOk && !isDuplicate) {
    await enqueueAffectedFiles(admin, provider, adapter.affectedFileExternalIds(payload))
  }

  // webhook 端點永遠快速回 200，避免 provider 重送（即使沒有可同步的 connection）。
  return Response.json({ ok: true, duplicate: isDuplicate }, { status: 200 })
}

type Admin = ReturnType<typeof createAdminClient>

/**
 * 對事件影響的每個檔案，找出這個 provider 底下「持續同步中（sync_status=active）」且連線仍有效
 * （design_connections.status=active，排除 revoked/expired/error）的 design_files 列，逐列入列 design.sync。
 * 一個檔案 id 可能對應多個 connection/space（不同使用者各自連了同一檔）→ 每列各入列一個 job。
 */
async function enqueueAffectedFiles(admin: Admin, provider: string, fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    const { data: rows, error } = await admin
      .from('design_files')
      .select('id, space_id, connection_id, external_id, design_connections!inner(status)')
      .eq('provider', provider)
      .eq('external_id', fileId)
      .eq('sync_status', 'active')
      .is('deleted_at', null)
      .eq('design_connections.status', 'active')

    if (error) {
      console.error('[webhook] 查詢受影響檔案失敗', { provider, fileId, message: error.message })
      continue
    }

    for (const row of rows ?? []) {
      const connectionId = row.connection_id
      if (!connectionId) continue // 理論上 !inner + df_external_check 已保證非空，防禦性略過
      const spaceId = row.space_id
      const rowExternalId = row.external_id ?? fileId
      // 與手動同步路徑（api/integrations/[key]/sync）完全相同的入列契約。
      const jobId = await enqueue(
        'design.sync',
        { connectionId, spaceId, externalId: rowExternalId, attempt: 1 },
        { singletonKey: `sync:${connectionId}:${rowExternalId}` },
      )
      // 入列失敗（queue 故障）不靜默：記錄下來（本專案視靜默失敗為 bug），但仍回 200。
      if (jobId === null) {
        console.error('[webhook] design.sync 入列失敗', { provider, connectionId, externalId: rowExternalId })
      }
    }
  }
}
