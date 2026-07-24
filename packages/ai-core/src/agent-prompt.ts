import { PROMPT_CACHE_MARKER } from './providers.js'

/**
 * Agent system prompt。見 docs/spec/07-agent.md §2。
 *
 * 穩定前綴（所有 space 相同 → 跨使用者共用 Anthropic prompt cache）與
 * 個人化後綴（每個 space 不同 → 不 cache）以 PROMPT_CACHE_MARKER 切分。
 * 前綴約 2000 token，放 cache breakpoint。
 */

export const AGENT_SYSTEM_PREFIX = `你是 SnowRealm Space 中的常駐 AI 夥伴。

## 你是什麼
- 助手、創作夥伴、這個空間的居民、設計評論者、整理者。

## 你不是什麼
- 你不是全知的。你只知道這則訊息中明確提供給你的內容。
- 你不是情緒診斷工具。不評論使用者的心理狀態、情緒或健康。
- 你不能存取任何未提供給你的檔案、對話或外部服務。
- 你不能在未經確認的情況下執行有副作用的操作。

## 最重要的規則：不要假裝看過沒看過的東西
如果使用者提到某個作品、專案或主題，但它不在下方的「當前脈絡」中，
你必須直接說你看不到，並請對方選取它。不要根據標題或數值編出畫面描述。

## 陳述分類
你的每一句實質內容都必須歸入以下五類之一：
- fact       系統中可查證的事實。必須指出來源 id。
- metric     可計算的數值。必須指出來源 id 與指標名稱。
- inference  從資料推論出的判斷。必須指出來源 id，信心值不得超過 0.85。
- suggestion 建議採取的行動。
- creative   創意內容：命名、比喻、文案、描述。

你不得自行計算任何數值。顏色數量、對比比值、留白比例這類數據一律由系統的
本地分析提供，會出現在下方脈絡中。若脈絡中沒有某個數值，就說沒有這項資料，不要估算。

## 語氣
- 溫暖但不諂媚。不要每句話都稱讚。
- 具體優於抽象。簡短，除非對方要求詳細，否則不超過三段。使用繁體中文。

## 禁止事項
- 不製造焦慮、不使用假稀缺、不假倒數、不情緒勒索。
- 不宣稱你想念使用者、離不開使用者，或對使用者有感情依賴。
- 不評論使用者的外貌、身體、感情狀態或財務狀況。
- 不在使用者沒問的情況下反覆提醒未完成的事。一次就好。
- 不使用無資料支撐的斷言。`

export type AgentContext = {
  localTime: string
  timezone: string
  spaceName: string
  currentRoute: string
  activeTheme?: { name: string; primary: string; secondary: string } | null
  selectedSnapshot?: {
    title: string
    createdAt: string
    projectName?: string | null
    localFeatures: Record<string, unknown>
    imageAttached: boolean
  } | null
  currentProject?: { name: string; status: string; description?: string | null } | null
  memories?: string[]
  recentActivity?: { occurredAt: string; description: string }[]
  availableTools?: { name: string; description: string; requiresConfirmation: boolean }[]
  memoryEnabled: boolean
}

/** 把巢狀值攤平成「key：value」行（供本地分析引用為 metric）。 */
function featureLines(features: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(features)) {
    if (v === null || v === undefined) continue
    lines.push(`- ${k}：${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  }
  return lines.join('\n')
}

/** 渲染個人化後綴（純函式，可測）。 */
export function renderContextSuffix(ctx: AgentContext): string {
  const parts: string[] = []
  parts.push('## 當前脈絡')
  parts.push(`時間：${ctx.localTime}（${ctx.timezone}）`)
  parts.push(`Space：${ctx.spaceName}`)
  parts.push(`目前頁面：${ctx.currentRoute}`)

  if (ctx.activeTheme) {
    parts.push(
      `\n### 目前主題\n名稱：${ctx.activeTheme.name}\n主色：${ctx.activeTheme.primary}／輔色：${ctx.activeTheme.secondary}`,
    )
  }

  if (ctx.selectedSnapshot) {
    const s = ctx.selectedSnapshot
    const seg = [`\n### 使用者選取的作品`, `標題：${s.title}`, `版本建立於：${s.createdAt}`]
    if (s.projectName) seg.push(`所屬專案：${s.projectName}`)
    seg.push(`\n本地分析（這些是可信的計算結果，可直接引用為 metric）：`)
    seg.push(featureLines(s.localFeatures))
    // 反幻覺關鍵分支（§2.2）
    seg.push(
      s.imageAttached
        ? `\n這張作品的圖片已附在本次訊息中，你可以直接觀察它。`
        : `\n⚠️ 圖片未附上，你只有上述數值，不得描述畫面內容。`,
    )
    parts.push(seg.join('\n'))
  }

  if (ctx.currentProject) {
    const p = ctx.currentProject
    parts.push(`\n### 目前專案\n${p.name}（狀態：${p.status}）${p.description ? `\n${p.description}` : ''}`)
  }

  if (ctx.memoryEnabled && ctx.memories?.length) {
    parts.push(
      `\n### 使用者已批准你記住的事\n${ctx.memories.map((m) => `- ${m}`).join('\n')}\n這些是使用者主動同意保存的。可自然運用，但不要每次刻意提起。`,
    )
  }

  if (ctx.recentActivity?.length) {
    parts.push(
      `\n### 最近活動\n${ctx.recentActivity.map((a) => `- ${a.occurredAt}：${a.description}`).join('\n')}`,
    )
  }

  if (ctx.availableTools?.length) {
    parts.push(
      `\n### 可用工具\n${ctx.availableTools.map((t) => `- ${t.name}：${t.description}${t.requiresConfirmation ? '（需使用者確認）' : ''}`).join('\n')}`,
    )
  }

  if (!ctx.memoryEnabled) {
    parts.push(`\n記憶功能目前為關閉狀態。你不得提議記住任何事，也不得引用任何記憶。`)
  }

  return parts.join('\n')
}

/** 組出完整 system prompt：前綴 + cache 標記 + 個人化後綴。 */
export function buildAgentSystemPrompt(ctx: AgentContext): string {
  return `${AGENT_SYSTEM_PREFIX}${PROMPT_CACHE_MARKER}\n\n${renderContextSuffix(ctx)}`
}
