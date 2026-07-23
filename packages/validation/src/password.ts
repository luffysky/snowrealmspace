/**
 * 密碼格式與強度。跟一般網站一樣：最低要求 + 強弱提示。
 *
 * 純函式，前端即時顯示強度、後端把關最低要求都用同一份。
 */

export const PASSWORD_MIN_LENGTH = 8

export type PasswordStrength = {
  /** 0=太弱 1=弱 2=中 3=強 4=很強 */
  score: 0 | 1 | 2 | 3 | 4
  label: string
  /** 是否達到可註冊的最低要求 */
  acceptable: boolean
  /** 給使用者的具體建議（達標時為 null） */
  hint: string | null
}

/**
 * 評估密碼強度。
 *
 * 最低要求：至少 8 字。
 * 強度：長度 + 字元種類（小寫/大寫/數字/符號）綜合。
 */
export function passwordStrength(password: string): PasswordStrength {
  const pw = password ?? ''
  const len = pw.length

  if (len === 0) {
    return { score: 0, label: '', acceptable: false, hint: null }
  }
  if (len < PASSWORD_MIN_LENGTH) {
    return {
      score: 0,
      label: '太短',
      acceptable: false,
      hint: `至少 ${PASSWORD_MIN_LENGTH} 個字`,
    }
  }

  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasDigit = /[0-9]/.test(pw)
  const hasSymbol = /[^A-Za-z0-9]/.test(pw)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  // 常見弱密碼樣式扣分
  const isRepetitive = /^(.)\1+$/.test(pw) // 全同一個字元
  const isSequential = /(0123|1234|2345|3456|abcd|qwer|password|nami)/i.test(pw)

  let score = 0
  if (len >= PASSWORD_MIN_LENGTH) score += 1
  if (len >= 12) score += 1
  if (variety >= 2) score += 1
  if (variety >= 3) score += 1
  if (isRepetitive || isSequential) score = Math.min(score, 1)

  const finalScore = Math.max(0, Math.min(4, score)) as PasswordStrength['score']

  const LABELS = ['太弱', '弱', '中', '強', '很強']
  const hint =
    finalScore <= 1
      ? '混合大小寫、數字或符號會更安全'
      : variety < 3 && finalScore < 4
        ? '再加一種字元（大寫／數字／符號）'
        : null

  return {
    score: finalScore,
    label: LABELS[finalScore] ?? '',
    // 最低要求只看長度（不強迫符號，但會用強度條引導）
    acceptable: len >= PASSWORD_MIN_LENGTH,
    hint,
  }
}
