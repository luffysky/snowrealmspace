import { getToolByName, needsConfirmation } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { audit } from '@snowrealm/analytics'
import type { ApiContext } from '@/lib/api/context'

/**
 * Tool 執行流程（07-agent.md §5）。
 *
 * 1. 找到 tool 定義（未知 → 拒絕）
 * 2. 需要確認的（apply_theme、tag_asset ≥3/replace）→ 建 pending_confirmation 的 agent_action，
 *    不立即執行；使用者在 UI 按確認後才走 confirm 端點執行。
 * 3. 不需確認的 → 立即執行並建 executed 的 agent_action。
 * 4. undoable 的執行前擷取前值存 undo_payload，24h 內可復原。
 *
 * Agent 沒有刪除/封存/分享/上傳工具（規則 8，結構上不存在，assertNoForbiddenTools 守著）。
 */

export type ToolExecOutcome =
  | { status: 'executed'; actionId: string; output: unknown }
  | { status: 'pending_confirmation'; actionId: string }
  | { status: 'rejected'; reason: string }

/** 各 tool 的實際執行（DB 操作）。回傳 output，並在需要時回傳 undo 前值。 */
type Handler = (
  ctx: ApiContext,
  admin: ReturnType<typeof createAdminClient>,
  input: Record<string, unknown>,
) => Promise<{ output: unknown; undo?: unknown }>

const HANDLERS: Record<string, Handler> = {
  save_memory_proposal: async (ctx, admin, input) => {
    // 提案（approved=false）—— ADR-014：Agent 不得直接 approved
    const { data } = await admin
      .from('memories')
      .insert({
        space_id: ctx.spaceId,
        created_by: null,
        type: String(input.type ?? 'other'),
        content: String(input.content ?? ''),
        source_type: 'agent_summary',
        sensitivity: input.sensitivity === 'private' ? 'private' : 'normal',
        approved: false,
        confidence: 0.7,
      })
      .select('id')
      .single()
    return { output: { memoryId: data?.id, pending: true } }
  },

  create_project: async (ctx, admin, input) => {
    const { data } = await admin
      .from('projects')
      .insert({
        space_id: ctx.spaceId,
        created_by: ctx.userId,
        name: String(input.name ?? '未命名專案'),
        description: input.description ? String(input.description) : null,
        status: input.status === 'active' ? 'active' : 'idea',
        tags: Array.isArray(input.tags) ? (input.tags as string[]) : [],
      })
      .select('id')
      .single()
    return { output: { projectId: data?.id }, undo: { projectId: data?.id } }
  },

  apply_theme: async (ctx, admin, input) => {
    const themeId = String(input.themeId ?? '')
    // 前值（供 undo）
    const { data: before } = await admin
      .from('spaces')
      .select('active_theme_id')
      .eq('id', ctx.spaceId)
      .maybeSingle()
    // 確認 theme 屬於本 space
    const { data: theme } = await admin
      .from('themes')
      .select('id')
      .eq('id', themeId)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()
    if (!theme) throw new Error('找不到指定的主題')
    await admin.from('spaces').update({ active_theme_id: themeId }).eq('id', ctx.spaceId)
    return { output: { applied: themeId }, undo: { previousThemeId: before?.active_theme_id ?? null } }
  },

  tag_asset: async (ctx, admin, input) => {
    const assetIds = (input.assetIds as string[] | undefined) ?? []
    const tags = ((input.tags as string[] | undefined) ?? []).map((t) => t.toLowerCase())
    const mode = input.mode === 'replace' ? 'replace' : 'add'
    const undoBefore: { id: string; tags: string[] }[] = []
    for (const id of assetIds) {
      const { data: a } = await admin
        .from('assets')
        .select('tags')
        .eq('id', id)
        .eq('space_id', ctx.spaceId)
        .maybeSingle()
      if (!a) continue
      undoBefore.push({ id, tags: a.tags ?? [] })
      const next =
        mode === 'replace' ? tags : Array.from(new Set([...(a.tags ?? []), ...tags]))
      await admin.from('assets').update({ tags: next }).eq('id', id).eq('space_id', ctx.spaceId)
    }
    return { output: { tagged: undoBefore.length }, undo: { previous: undoBefore } }
  },
}

export function isExecutableTool(name: string): boolean {
  return name in HANDLERS
}

/**
 * 進入點：驗證 → 權限 → 確認閘門 → 執行。
 * 回傳 pending_confirmation 時，呼叫端（UI）需帶使用者確認走 confirmAction。
 */
export async function executeToolCall(
  ctx: ApiContext,
  toolName: string,
  input: Record<string, unknown>,
  messageId?: string,
): Promise<ToolExecOutcome> {
  const tool = getToolByName(toolName)
  if (!tool) return { status: 'rejected', reason: `未知的工具：${toolName}` }
  if (!isExecutableTool(toolName)) {
    return { status: 'rejected', reason: `工具 ${toolName} 尚未接上執行` }
  }

  const admin = createAdminClient()
  const mustConfirm = needsConfirmation(toolName, input)

  // 建 agent_action 記錄
  const { data: action, error } = await admin
    .from('agent_actions')
    .insert({
      space_id: ctx.spaceId,
      message_id: messageId ?? null,
      tool_name: toolName,
      input: input as never,
      status: mustConfirm ? 'pending_confirmation' : 'approved',
      requires_confirmation: mustConfirm,
    })
    .select('id')
    .single()
  if (error || !action) return { status: 'rejected', reason: '無法建立動作記錄' }

  if (mustConfirm) {
    return { status: 'pending_confirmation', actionId: action.id }
  }

  return runAction(ctx, admin, action.id, toolName, input)
}

/** 使用者確認後執行一個 pending 的 action。 */
export async function confirmAction(ctx: ApiContext, actionId: string): Promise<ToolExecOutcome> {
  const admin = createAdminClient()
  const { data: action } = await admin
    .from('agent_actions')
    .select('id, tool_name, input, status')
    .eq('id', actionId)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!action) return { status: 'rejected', reason: '找不到這個動作' }
  if (action.status !== 'pending_confirmation') {
    return { status: 'rejected', reason: '這個動作已經處理過了' }
  }
  await admin
    .from('agent_actions')
    .update({ status: 'approved', confirmed_by: ctx.userId, confirmed_at: new Date().toISOString() })
    .eq('id', actionId)
  return runAction(ctx, admin, actionId, action.tool_name, action.input as Record<string, unknown>)
}

export async function rejectAction(ctx: ApiContext, actionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('agent_actions')
    .update({ status: 'rejected' })
    .eq('id', actionId)
    .eq('space_id', ctx.spaceId)
    .eq('status', 'pending_confirmation')
    .select('id')
    .maybeSingle()
  return Boolean(data)
}

const UNDO_WINDOW_MS = 24 * 3600 * 1000

/** 24 小時內復原一個已執行的動作（§4.1 undoable + undo_payload）。 */
export async function undoAction(ctx: ApiContext, actionId: string): Promise<ToolExecOutcome> {
  const admin = createAdminClient()
  const { data: action } = await admin
    .from('agent_actions')
    .select('id, tool_name, status, undo_payload, created_at, undone_at')
    .eq('id', actionId)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!action) return { status: 'rejected', reason: '找不到這個動作' }
  if (action.status !== 'executed' || action.undone_at) {
    return { status: 'rejected', reason: '這個動作無法復原' }
  }
  if (Date.now() - new Date(action.created_at).getTime() > UNDO_WINDOW_MS) {
    return { status: 'rejected', reason: '已超過 24 小時復原期限' }
  }

  const undo = (action.undo_payload ?? {}) as Record<string, unknown>
  try {
    if (action.tool_name === 'create_project' && undo.projectId) {
      await admin
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', String(undo.projectId))
        .eq('space_id', ctx.spaceId)
    } else if (action.tool_name === 'apply_theme') {
      await admin
        .from('spaces')
        .update({ active_theme_id: (undo.previousThemeId as string | null) ?? null })
        .eq('id', ctx.spaceId)
    } else if (action.tool_name === 'tag_asset' && Array.isArray(undo.previous)) {
      for (const p of undo.previous as { id: string; tags: string[] }[]) {
        await admin.from('assets').update({ tags: p.tags }).eq('id', p.id).eq('space_id', ctx.spaceId)
      }
    } else if (action.tool_name === 'save_memory_proposal' && undo) {
      // 提案復原：直接刪掉那筆 pending 記憶（若還在）
      const out = (
        await admin.from('agent_actions').select('output').eq('id', actionId).maybeSingle()
      ).data?.output as { memoryId?: string } | null
      if (out?.memoryId) {
        await admin
          .from('memories')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', out.memoryId)
          .eq('space_id', ctx.spaceId)
      }
    }
    await admin.from('agent_actions').update({ status: 'rolled_back', undone_at: new Date().toISOString() }).eq('id', actionId)
    return { status: 'executed', actionId, output: { undone: true } }
  } catch (e) {
    return { status: 'rejected', reason: (e as Error).message }
  }
}

async function runAction(
  ctx: ApiContext,
  admin: ReturnType<typeof createAdminClient>,
  actionId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolExecOutcome> {
  const tool = getToolByName(toolName)!
  const handler = HANDLERS[toolName]!
  try {
    const { output, undo } = await handler(ctx, admin, input)
    await admin
      .from('agent_actions')
      .update({
        status: 'executed',
        output: output as never,
        ...(tool.undoable && undo !== undefined ? { undo_payload: undo as never } : {}),
      })
      .eq('id', actionId)
    await audit({
      spaceId: ctx.spaceId,
      actorId: ctx.userId,
      actorType: 'agent',
      action: tool.auditAction,
      entityType: 'agent_action',
      entityId: actionId,
      after: output as Record<string, unknown>,
    }).catch(() => {})
    return { status: 'executed', actionId, output }
  } catch (e) {
    await admin
      .from('agent_actions')
      .update({ status: 'failed', error: (e as Error).message })
      .eq('id', actionId)
    return { status: 'rejected', reason: (e as Error).message }
  }
}
