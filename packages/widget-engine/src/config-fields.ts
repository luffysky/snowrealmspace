import { z } from 'zod'
import { getWidgetDefinition, type WidgetId } from './registry.js'

/**
 * 從 widget 的 zod configSchema 產生欄位描述，讓設定面板能自動生成。
 *
 * ## 為什麼要這一層
 *
 * config schema 一直存在（06-widget-contract.md §4），但沒有介面 ——
 * 使用者改不了任何 widget 設定。手寫每個 widget 的設定表單是重工，
 * 而且新增 widget 時很容易忘記補表單。
 *
 * 這裡讀 zod schema 的結構產出中性的欄位描述，UI 依型別渲染控制項。
 * schema 是唯一真相：加一個 config 欄位，設定面板自動就有。
 *
 * ## 只支援設定面板實際需要的型別
 *
 * boolean / number / enum / string。巢狀物件與陣列不支援 ——
 * 目前沒有 widget 需要，硬做只會產生用不到的複雜度。
 * 遇到不支援的型別回 `kind: 'unsupported'`，UI 明確跳過而不是猜。
 */

export type ConfigField =
  | { key: string; label: string; kind: 'boolean'; default: boolean }
  | {
      key: string
      label: string
      kind: 'number'
      default: number
      min?: number
      max?: number
      step?: number
    }
  | { key: string; label: string; kind: 'enum'; default: string; options: string[] }
  | { key: string; label: string; kind: 'string'; default: string; maxLength?: number }
  | { key: string; label: string; kind: 'unsupported' }

/** 欄位名 → 人看得懂的標籤。找不到就用欄位名，不會是空白。 */
const LABELS: Record<string, string> = {
  showArchiveLink: '顯示封存連結',
  compact: '精簡模式',
  autoOpenOnLogin: '登入時自動打開',
  showRarityLabel: '顯示稀有度',
  showAvatar: '顯示頭像',
  maxMessages: '最多顯示幾則',
  allowQuickReply: '允許快速回覆',
  showProgress: '顯示進度',
  showRecentAssets: '顯示最近作品',
  limit: '顯示數量',
  layout: '排列方式',
  placeholder: '提示文字',
  autoSaveSeconds: '自動儲存間隔（秒）',
  showFavoritesOnly: '只顯示我的最愛',
  showPlaylistName: '顯示清單名稱',
  allowSkip: '允許切換',
  allowPause: '允許暫停',
  view: '檢視',
}

function labelFor(key: string): string {
  return LABELS[key] ?? key
}

/** 剝掉 ZodDefault / ZodOptional 外殼，取得底層型別與預設值。 */
function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; default: unknown } {
  let current = schema
  let defaultValue: unknown

  // 可能包好幾層（例如 .optional().default(x)）
  for (let guard = 0; guard < 5; guard++) {
    const typeName = (current._def as { typeName?: string }).typeName
    if (typeName === 'ZodDefault') {
      const def = current._def as { defaultValue: () => unknown; innerType: z.ZodTypeAny }
      defaultValue = def.defaultValue()
      current = def.innerType
      continue
    }
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      current = (current._def as { innerType: z.ZodTypeAny }).innerType
      continue
    }
    break
  }

  return { inner: current, default: defaultValue }
}

function describeField(key: string, schema: z.ZodTypeAny): ConfigField {
  const { inner, default: def } = unwrap(schema)
  const typeName = (inner._def as { typeName?: string }).typeName
  const label = labelFor(key)

  if (typeName === 'ZodBoolean') {
    return { key, label, kind: 'boolean', default: def === true }
  }

  if (typeName === 'ZodNumber') {
    const checks = (inner._def as { checks?: { kind: string; value: number }[] }).checks ?? []
    const min = checks.find((c) => c.kind === 'min')?.value
    const max = checks.find((c) => c.kind === 'max')?.value
    const isInt = checks.some((c) => c.kind === 'int')
    return {
      key,
      label,
      kind: 'number',
      default: typeof def === 'number' ? def : (min ?? 0),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      step: isInt ? 1 : 0.1,
    }
  }

  if (typeName === 'ZodEnum') {
    const options = (inner._def as { values: string[] }).values
    return {
      key,
      label,
      kind: 'enum',
      default: typeof def === 'string' ? def : (options[0] ?? ''),
      options,
    }
  }

  if (typeName === 'ZodString') {
    const checks = (inner._def as { checks?: { kind: string; value: number }[] }).checks ?? []
    // uuid / url / email 這類「有格式」的字串不是自由文字 ——
    // projectId 要用專門的選擇器，不能給一個純文字框讓人手打 uuid。
    const isFormatted = checks.some((c) => ['uuid', 'url', 'email', 'regex'].includes(c.kind))
    if (isFormatted) return { key, label, kind: 'unsupported' }

    const maxLength = checks.find((c) => c.kind === 'max')?.value
    return {
      key,
      label,
      kind: 'string',
      default: typeof def === 'string' ? def : '',
      ...(maxLength !== undefined ? { maxLength } : {}),
    }
  }

  // uuid 參照（projectId 等）與其他型別：設定面板不處理，
  // 那些要用專門的選擇器，不是通用表單能做的。
  return { key, label, kind: 'unsupported' }
}

/**
 * 描述一個 widget 的可編輯設定欄位。
 *
 * 只回傳通用表單能渲染的欄位；unsupported 的欄位會被過濾掉，
 * 但**保留在 log 判斷用的完整清單**，避免「設定面板是空的」時
 * 分不清是沒有設定還是全部不支援。
 */
export function describeConfig(widgetId: WidgetId): ConfigField[] {
  const definition = getWidgetDefinition(widgetId)
  if (!definition) return []

  const schema = definition.configSchema
  const shape = (schema as unknown as { _def?: { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> } })
    ._def

  if (shape?.typeName !== 'ZodObject' || !shape.shape) return []

  const fields: ConfigField[] = []
  for (const [key, fieldSchema] of Object.entries(shape.shape())) {
    fields.push(describeField(key, fieldSchema))
  }
  return fields
}

/** 只回可在通用表單編輯的欄位。 */
export function editableConfigFields(widgetId: WidgetId): Exclude<ConfigField, { kind: 'unsupported' }>[] {
  return describeConfig(widgetId).filter(
    (f): f is Exclude<ConfigField, { kind: 'unsupported' }> => f.kind !== 'unsupported',
  )
}

/**
 * 用 schema 驗證並填入預設值。設定面板送出前呼叫，
 * 確保存進 DB 的 config 一定合法（前端控制項理論上不會產生非法值，
 * 但手改的請求會 —— schema 是最後一道）。
 */
export function parseConfig(widgetId: WidgetId, value: unknown): unknown {
  const definition = getWidgetDefinition(widgetId)
  if (!definition) return value
  const result = definition.configSchema.safeParse(value)
  return result.success ? result.data : definition.defaultConfig
}
