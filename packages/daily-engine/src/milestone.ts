/**
 * 里程碑回顧。依「註冊至今的天數」在**剛好到某個節點的那一天**顯示一則回顧
 * （呼應使用者要的「剛好滿 N 天才顯示」）。非每日輪替、非事後永遠顯示 ——
 * 只在當天出現。內容用 tags 對應里程碑 key（day_7 / year_1 …），沒有對應才退 generic。
 */

// 固定天數節點 → 中文標籤。
const FIXED_DAYS: Record<number, string> = {
  7: '第一週',
  14: '滿兩週',
  21: '第三週',
  30: '滿一個月',
  50: '第 50 天',
  60: '滿兩個月',
  100: '第 100 天',
  150: '第 150 天',
  200: '第 200 天',
  250: '第 250 天',
  300: '第 300 天',
  400: '第 400 天',
  500: '第 500 天',
  600: '第 600 天',
  800: '第 800 天',
  1000: '第 1000 天',
  1500: '第 1500 天',
  2000: '第 2000 天',
  2500: '第 2500 天',
  3000: '第 3000 天',
  3650: '第 3650 天',
}

/** 今天（註冊後第 days 天）是不是里程碑；是就回傳 key 與標籤。整年優先。 */
export function milestoneFor(days: number): { key: string; label: string } | null {
  if (days > 0 && days % 365 === 0) {
    const year = days / 365
    return { key: `year_${year}`, label: `滿 ${year} 年` }
  }
  const label = FIXED_DAYS[days]
  if (label) return { key: `day_${days}`, label }
  return null
}
