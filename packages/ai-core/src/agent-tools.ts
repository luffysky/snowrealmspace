import type { ToolDefinition } from './types.js'

/**
 * Agent 的 10 個 tool。見 docs/spec/07-agent.md §4。
 *
 * 不可違反規則 8：Agent 沒有刪除、封存、中斷連線、對外分享、上傳第三方的工具。
 * 這些能力「根本不提供」而非「要求確認」—— 最安全的權限模型是不存在那個能力。
 * assertNoForbiddenTools 把這條做成可測的結構保證。
 */

export type Permission =
  | 'notes:write'
  | 'projects:write'
  | 'themes:write'
  | 'themes:apply'
  | 'backgrounds:write'
  | 'assets:tag'
  | 'daily:write'
  | 'memory:propose'
  | 'design:read'

export type AgentToolDefinition = {
  name: string
  description: string
  inputSchema: object
  permission: Permission
  requiresConfirmation: boolean
  auditAction: string
  undoable: boolean
}

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'create_note',
    description: '建立一則筆記，可選擇歸屬某個專案。',
    inputSchema: obj(
      {
        title: { type: 'string', maxLength: 120 },
        body: { type: 'string', maxLength: 8000 },
        projectId: { type: 'string', format: 'uuid' },
      },
      ['body'],
    ),
    permission: 'notes:write',
    requiresConfirmation: false,
    auditAction: 'agent.note.created',
    undoable: true,
  },
  {
    name: 'create_project',
    description: '建立新專案。只在使用者明確表達要開始一個新專案時使用。',
    inputSchema: obj(
      {
        name: { type: 'string', minLength: 1, maxLength: 80 },
        description: { type: 'string', maxLength: 2000 },
        status: { type: 'string', enum: ['idea', 'active'] },
        tags: { type: 'array', items: { type: 'string', maxLength: 24 }, maxItems: 10 },
      },
      ['name'],
    ),
    permission: 'projects:write',
    requiresConfirmation: false,
    auditAction: 'agent.project.created',
    undoable: true,
  },
  {
    name: 'create_theme_draft',
    description: '建立一份主題草稿供使用者預覽。草稿不會自動套用。',
    inputSchema: obj(
      {
        name: { type: 'string', maxLength: 80 },
        definition: { type: 'object' },
        rationale: { type: 'string', maxLength: 600 },
      },
      ['name', 'definition'],
    ),
    permission: 'themes:write',
    requiresConfirmation: false,
    auditAction: 'agent.theme.drafted',
    undoable: true,
  },
  {
    name: 'apply_theme',
    description: '把某個主題套用到 Home Space。這會改變整個空間的外觀。',
    inputSchema: obj({ themeId: { type: 'string', format: 'uuid' } }, ['themeId']),
    permission: 'themes:apply',
    requiresConfirmation: true, // v1.0 §21.5
    auditAction: 'agent.theme.applied',
    undoable: true,
  },
  {
    name: 'create_palette',
    description: '產生一組配色供使用者參考。不會建立主題。',
    inputSchema: obj(
      {
        mood: { type: 'string', maxLength: 60 },
        baseColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        count: { type: 'integer', minimum: 3, maximum: 8 },
      },
      ['mood'],
    ),
    permission: 'themes:write',
    requiresConfirmation: false,
    auditAction: 'agent.palette.created',
    undoable: false,
  },
  {
    name: 'add_background',
    description: '把某個作品或圖片加入背景清單。',
    inputSchema: obj(
      {
        assetId: { type: 'string', format: 'uuid' },
        playlistId: { type: 'string', format: 'uuid' },
        settings: { type: 'object' },
      },
      ['assetId'],
    ),
    permission: 'backgrounds:write',
    requiresConfirmation: false,
    auditAction: 'agent.background.added',
    undoable: true,
  },
  {
    name: 'compare_design_versions',
    description: '比較同一作品的兩個版本。回傳本地計算的差異數據。',
    inputSchema: obj(
      {
        snapshotIdA: { type: 'string', format: 'uuid' },
        snapshotIdB: { type: 'string', format: 'uuid' },
      },
      ['snapshotIdA', 'snapshotIdB'],
    ),
    permission: 'design:read',
    requiresConfirmation: false,
    auditAction: 'agent.design.compared',
    undoable: false,
  },
  {
    name: 'tag_asset',
    description: '為作品加上標籤。一次最多 10 個 asset。',
    inputSchema: obj(
      {
        assetIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 10 },
        tags: { type: 'array', items: { type: 'string', maxLength: 24 }, minItems: 1, maxItems: 10 },
        mode: { type: 'string', enum: ['add', 'replace'] },
      },
      ['assetIds', 'tags'],
    ),
    permission: 'assets:tag',
    requiresConfirmation: true, // 動態：≥3 asset 或 replace（見 needsConfirmation）
    auditAction: 'agent.assets.tagged',
    undoable: true,
  },
  {
    name: 'create_daily_card',
    description: '為今天建立一張每日卡片。同一天同類型只能有一張。',
    inputSchema: obj(
      {
        title: { type: 'string', maxLength: 80 },
        body: { type: 'string', maxLength: 500 },
        kind: { type: 'string', enum: ['daily_card', 'agent_note', 'creative_prompt'] },
      },
      ['body', 'kind'],
    ),
    permission: 'daily:write',
    requiresConfirmation: false,
    auditAction: 'agent.daily.created',
    undoable: true,
  },
  {
    name: 'save_memory_proposal',
    description: '提議記住某件事。這只會建立提案，需要使用者按下同意才會保存。',
    inputSchema: obj(
      {
        content: { type: 'string', minLength: 4, maxLength: 500 },
        type: {
          type: 'string',
          enum: ['preference', 'project_context', 'design_taste', 'habit', 'milestone', 'other'],
        },
        rationale: { type: 'string', maxLength: 300 },
        sensitivity: { type: 'string', enum: ['normal', 'private'] },
      },
      ['content', 'type'],
    ),
    permission: 'memory:propose',
    requiresConfirmation: false,
    auditAction: 'agent.memory.proposed',
    undoable: true,
  },
]

/** Agent 絕不可擁有的能力（規則 8）。這些字樣出現在 tool 名稱即為設計錯誤。 */
export const FORBIDDEN_TOOL_PATTERNS = [
  /delete/i,
  /remove/i,
  /archive/i,
  /disconnect/i,
  /share/i,
  /upload/i,
  /export/i,
  /publish/i,
]

/** 結構保證：註冊表不得含任何禁止能力。測試會呼叫這個。 */
export function assertNoForbiddenTools(tools: AgentToolDefinition[] = AGENT_TOOLS): void {
  for (const t of tools) {
    for (const pat of FORBIDDEN_TOOL_PATTERNS) {
      if (pat.test(t.name)) {
        throw new Error(`禁止的 Agent 能力出現在 tool「${t.name}」（規則 8）`)
      }
    }
  }
}

export function getToolByName(name: string): AgentToolDefinition | undefined {
  return AGENT_TOOLS.find((t) => t.name === name)
}

/**
 * 動態確認判定（§4.3）。tag_asset 在 ≥3 個 asset 或 mode='replace' 時要確認；
 * 其餘依 requiresConfirmation 靜態值。
 */
export function needsConfirmation(toolName: string, input: Record<string, unknown>): boolean {
  const tool = getToolByName(toolName)
  if (!tool) return true // 未知 tool 一律要確認（保守）
  if (toolName === 'tag_asset') {
    const ids = Array.isArray(input.assetIds) ? input.assetIds.length : 0
    return ids >= 3 || input.mode === 'replace'
  }
  return tool.requiresConfirmation
}

/** 轉成 callAI 用的 ToolDefinition（name/description/parameters）。 */
export function toProviderTools(tools: AgentToolDefinition[] = AGENT_TOOLS): ToolDefinition[] {
  return tools.map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }))
}
