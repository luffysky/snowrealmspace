/**
 * 錯誤分類與低信心偵測。見 docs/spec/12-ai-model-routing.md §4.2、§4.4。
 * 正則完整照搬 AI 島實作，不精簡（移植檢查清單）。
 */

export class QuotaExceededError extends Error {
  constructor(
    message = '免費額度已用盡',
    readonly resetsAt?: string,
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

export class AllCandidatesFailedError extends Error {
  constructor(
    message = '所有候選模型都失敗',
    readonly attempts = 0,
  ) {
    super(message)
    this.name = 'AllCandidatesFailedError'
  }
}

/**
 * 值得換模型的錯誤（§4.2）。
 * - 429/quota/exceeded：免費額度用完 —— 免費優先最常見路徑，必須無感切換
 * - 404/not found/deprecated：模型下架 —— 免費 provider 換模型頻繁
 * - 401/invalid key：某家金鑰失效 —— 不能讓一把壞金鑰弄死整個功能
 * - 5xx/overloaded/timeout：暫時性
 *
 * 不在此列的（prompt 格式錯、內容政策拒絕）必須直接拋，不可靜默換模型重試 ——
 * 那會把一個 bug 變成 N 倍無效呼叫。
 */
export function isQuotaOrTransientError(e: unknown): boolean {
  const s = String((e as Error)?.message ?? e).toLowerCase()
  return (
    /\b(401|402|403|404|429|500|502|503|529)\b/.test(s) ||
    /(quota|rate.?limit|overloaded|insufficient|exceeded|payment|credit|too many requests|capacity|unavailable|timeout|aborted|not.?found|no longer available|does not exist|deprecated|decommission|authentication|unauthorized|invalid.?(api.?)?key|invalid token|forbidden)/.test(
      s,
    )
  )
}

/** 拒答模式（§4.4）。照搬 AI 島，涵蓋中英。 */
export const REFUSAL_PATTERNS: readonly RegExp[] = [
  /抱歉[，,\s]*我(?:無法|不能|沒有辦法)/,
  /我(?:無法|不能|沒辦法)(?:回答|協助|幫助|提供)/,
  /as an ai\b/i,
  /i(?:'m| am) (?:sorry|unable)\b/i,
  /i can(?:'t|not)\b/i,
  /無法回答|無可奉告|超出.*範圍/,
]

/**
 * 低信心偵測（§4.4）：空、過短、或命中拒答模式。
 * 免費模型答不好時的安全網 —— 觸發升級到付費模型再試一次。
 */
export function looksLowConfidence(text: string, minChars = 12): boolean {
  const t = (text ?? '').trim()
  if (!t) return true
  if (t.replace(/\s+/g, '').length < minChars) return true
  return REFUSAL_PATTERNS.some((re) => re.test(t))
}
