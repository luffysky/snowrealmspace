import { createHash } from 'node:crypto'
import { getToolByName, needsConfirmation } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { audit } from '@snowrealm/analytics'
import { compareLocalFeatures, parseColor, rgbToHsl, hslToRgb, toHex, type LocalFeatures } from '@snowrealm/theme-engine'
import type { ApiContext } from '@/lib/api/context'

/** 從基準色（或依 mood 推一個 hue）生成一組協調配色。純函式、決定性。 */
function generatePalette(baseHex: string, count: number): string[] {
  const rgba = parseColor(baseHex)
  if (!rgba) return [baseHex]
  const hsl = rgbToHsl(rgba)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const h = (hsl.h + (360 / count) * i) % 360
    const l = Math.min(0.85, Math.max(0.25, hsl.l + (i % 2 === 0 ? 0 : 0.12)))
    out.push(toHex(hslToRgb({ h, s: Math.max(0.35, hsl.s), l })))
  }
  return out
}
function hueFromMood(mood: string): string {
  let h = 0
  for (const c of mood) h = (h + c.charCodeAt(0) * 7) % 360
  return toHex(hslToRgb({ h, s: 0.6, l: 0.55 }))
}

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
    const { data, error } = await admin
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
    // 寫入失敗必須拋錯，讓 runAction 標成 failed —— 不能回報假成功（靜默失敗是 bug）
    if (error || !data) throw new Error(`儲存記憶提案失敗：${error?.message ?? '未知錯誤'}`)
    return { output: { memoryId: data.id, pending: true } }
  },

  create_project: async (ctx, admin, input) => {
    const { data, error } = await admin
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
    if (error || !data) throw new Error(`建立專案失敗：${error?.message ?? '未知錯誤'}`)
    return { output: { projectId: data.id }, undo: { projectId: data.id } }
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
    const { error: applyErr } = await admin
      .from('spaces')
      .update({ active_theme_id: themeId })
      .eq('id', ctx.spaceId)
    if (applyErr) throw new Error(`套用主題失敗：${applyErr.message}`)
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
      const { error: tagErr } = await admin
        .from('assets')
        .update({ tags: next })
        .eq('id', id)
        .eq('space_id', ctx.spaceId)
      if (tagErr) throw new Error(`更新標籤失敗：${tagErr.message}`)
    }
    return { output: { tagged: undoBefore.length }, undo: { previous: undoBefore } }
  },

  create_note: async (ctx, admin, input) => {
    const { data, error } = await admin
      .from('notes')
      .insert({
        space_id: ctx.spaceId,
        created_by: ctx.userId,
        title: input.title ? String(input.title) : null,
        body: String(input.body ?? ''),
        project_id: input.projectId ? String(input.projectId) : null,
      } as never)
      .select('id')
      .single()
    if (error || !data) throw new Error(`建立筆記失敗：${error?.message ?? '未知錯誤'}`)
    return { output: { noteId: (data as { id: string }).id }, undo: { noteId: (data as { id: string }).id } }
  },

  create_theme_draft: async (ctx, admin, input) => {
    const { data, error } = await admin
      .from('themes')
      .insert({
        space_id: ctx.spaceId,
        created_by: ctx.userId,
        name: String(input.name ?? '主題草稿'),
        definition: (input.definition ?? {}) as never,
      } as never)
      .select('id')
      .single()
    if (error || !data) throw new Error(`建立主題草稿失敗：${error?.message ?? '未知錯誤'}`)
    // 草稿只是建立、不套用（apply_theme 才套用）
    return { output: { themeId: (data as { id: string }).id, draft: true }, undo: { themeId: (data as { id: string }).id } }
  },

  create_palette: async (_ctx, _admin, input) => {
    const count = Math.min(8, Math.max(3, Number(input.count ?? 5)))
    const base =
      typeof input.baseColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.baseColor)
        ? input.baseColor
        : hueFromMood(String(input.mood ?? ''))
    return { output: { mood: input.mood ?? null, baseColor: base, colors: generatePalette(base, count) } }
  },

  add_background: async (ctx, admin, input) => {
    const assetId = String(input.assetId ?? '')
    const { data: asset } = await admin
      .from('assets')
      .select('id, kind')
      .eq('id', assetId)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!asset) throw new Error('找不到這個檔案')
    if (asset.kind !== 'image') throw new Error('只有圖片能當背景')
    const { data, error } = await admin
      .from('background_items')
      .insert({ space_id: ctx.spaceId, created_by: ctx.userId, asset_id: assetId, type: 'image' } as never)
      .select('id')
      .single()
    if (error || !data) throw new Error(`加入背景失敗：${error?.message ?? '未知錯誤'}`)
    return { output: { backgroundItemId: (data as { id: string }).id }, undo: { backgroundItemId: (data as { id: string }).id } }
  },

  compare_design_versions: async (ctx, admin, input) => {
    const idA = String(input.snapshotIdA ?? '')
    const idB = String(input.snapshotIdB ?? '')
    const { data: rows } = await admin
      .from('design_snapshots')
      .select('id, asset_id, extracted_features')
      .in('id', [idA, idB])
      .eq('space_id', ctx.spaceId)
    const rowA = rows?.find((r) => r.id === idA)
    const rowB = rows?.find((r) => r.id === idB)
    if (!rowA || !rowB) throw new Error('找不到指定的版本快照')
    const comparison = compareLocalFeatures(
      rowA.extracted_features as unknown as LocalFeatures,
      rowB.extracted_features as unknown as LocalFeatures,
    )
    return { output: { comparison, a: rowA.id, b: rowB.id } }
  },

  create_daily_card: async (ctx, admin, input) => {
    const kind = ['daily_card', 'agent_note', 'creative_prompt'].includes(String(input.kind))
      ? String(input.kind)
      : 'agent_note'
    const body = String(input.body ?? '')
    const { data: sp } = await admin.from('spaces').select('timezone').eq('id', ctx.spaceId).maybeSingle()
    const tz = sp?.timezone ?? 'Asia/Taipei'
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const contentHash = createHash('sha256').update(`${kind}:${body}`).digest('hex').slice(0, 32)
    const { data, error } = await admin
      .from('daily_items')
      .insert({
        space_id: ctx.spaceId,
        local_date: localDate,
        kind,
        title: input.title ? String(input.title) : null,
        body,
        source: 'generated',
        content_hash: contentHash,
        status: 'delivered',
      } as never)
      .select('id')
      .single()
    if (error || !data) throw new Error(`建立每日卡片失敗：${error?.message ?? '未知錯誤'}`)
    return { output: { dailyItemId: (data as { id: string }).id, kind, localDate }, undo: { dailyItemId: (data as { id: string }).id } }
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
    } else if (action.tool_name === 'create_note' && undo.noteId) {
      await admin.from('notes').update({ deleted_at: new Date().toISOString() } as never).eq('id', String(undo.noteId)).eq('space_id', ctx.spaceId)
    } else if (action.tool_name === 'create_theme_draft' && undo.themeId) {
      await admin.from('themes').update({ deleted_at: new Date().toISOString() } as never).eq('id', String(undo.themeId)).eq('space_id', ctx.spaceId)
    } else if (action.tool_name === 'add_background' && undo.backgroundItemId) {
      await admin.from('background_items').update({ deleted_at: new Date().toISOString() } as never).eq('id', String(undo.backgroundItemId)).eq('space_id', ctx.spaceId)
    } else if (action.tool_name === 'create_daily_card' && undo.dailyItemId) {
      await admin.from('daily_items').delete().eq('id', String(undo.dailyItemId)).eq('space_id', ctx.spaceId)
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
