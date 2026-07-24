import { AGENT_TOOLS, type AgentContext } from '@snowrealm/ai-core'
import type { ApiContext } from '@/lib/api/context'

/**
 * Context Builder（07-agent.md §3）—— 蒐集這個 space 的當前脈絡組成 AgentContext。
 *
 * 記憶檢索的 embedding/pgvector 語意排序需要 AI 金鑰（usage key 'embedding'），
 * 設金鑰後再接；目前先取最近的已批准、非 restricted 記憶（restricted 永不進 context，§3.2）。
 * 對話歷史摘要同理待金鑰。
 */

export type BuildContextOpts = {
  route?: string
  selectedSnapshotId?: string
}

export async function buildAgentContext(
  ctx: ApiContext,
  opts: BuildContextOpts = {},
): Promise<AgentContext> {
  const db = ctx.db

  const { data: space } = await db
    .from('spaces')
    .select('name, timezone, active_theme_id')
    .eq('id', ctx.spaceId)
    .maybeSingle()
  const timezone = space?.timezone ?? 'Asia/Taipei'
  const localTime = new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  const { data: settings } = await db
    .from('space_settings')
    .select('memory_enabled')
    .eq('space_id', ctx.spaceId)
    .maybeSingle()

  // 套用中的主題（active_theme_id 在 spaces 表）
  let activeTheme: AgentContext['activeTheme'] = null
  if (space?.active_theme_id) {
    const { data: theme } = await db
      .from('themes')
      .select('name, definition')
      .eq('id', space.active_theme_id)
      .maybeSingle()
    if (theme) {
      const colors = (theme.definition as { colors?: { primary?: string; secondary?: string } })?.colors
      activeTheme = {
        name: theme.name,
        primary: colors?.primary ?? '',
        secondary: colors?.secondary ?? '',
      }
    }
  }

  const memoryEnabled = settings?.memory_enabled ?? false

  // 記憶：已批准、非 restricted（restricted 永不進 context）
  let memories: string[] = []
  if (memoryEnabled) {
    const { data: mem } = await db
      .from('memories')
      .select('content, sensitivity')
      .eq('space_id', ctx.spaceId)
      .eq('approved', true)
      .neq('sensitivity', 'restricted')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8)
    memories = (mem ?? []).map((m) => m.content)
  }

  // 設計原則
  const { data: principlesRows } = await db
    .from('design_principles')
    .select('title, body')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .limit(20)
  const principles = (principlesRows ?? []).map((p) => (p.body ? `${p.title}：${p.body}` : p.title))

  // 最近活動（timeline）
  const { data: activity } = await db
    .from('timeline_events')
    .select('title, occurred_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(5)
  const recentActivity = (activity ?? []).map((a) => ({
    occurredAt: new Date(a.occurred_at).toLocaleDateString('zh-TW'),
    description: a.title,
  }))

  // 選取的作品（若有）—— 文字對話不附圖，imageAttached=false（§2.2 反幻覺）
  let selectedSnapshot: AgentContext['selectedSnapshot'] = null
  if (opts.selectedSnapshotId) {
    const { data: snap } = await db
      .from('design_snapshots')
      .select('created_at, extracted_features, design_file_id, files:design_files(title)')
      .eq('id', opts.selectedSnapshotId)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()
    if (snap) {
      const title = (snap as { files?: { title?: string } }).files?.title ?? '某件作品'
      selectedSnapshot = {
        title,
        createdAt: new Date(snap.created_at).toLocaleDateString('zh-TW'),
        localFeatures: (snap.extracted_features as Record<string, unknown>) ?? {},
        imageAttached: false,
      }
    }
  }

  return {
    localTime,
    timezone,
    spaceName: space?.name ?? 'Space',
    currentRoute: opts.route ?? '/home',
    activeTheme,
    selectedSnapshot,
    memories,
    principles,
    recentActivity,
    availableTools: AGENT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      requiresConfirmation: t.requiresConfirmation,
    })),
    memoryEnabled,
  }
}
