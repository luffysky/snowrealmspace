import { createAdminClient } from '@snowrealm/db/server'
import { hashToUnit } from '@snowrealm/validation'

/**
 * 歡迎鏈：非生日時，首頁每天一句歡迎（回家的感覺）。
 * 每日輪替、決定性挑選（同一天穩定，重整不換），不存 DB。
 */
export async function getWelcomeLine(spaceId: string, timeZone: string): Promise<string | null> {
  const admin = createAdminClient()
  const date = localDate(timeZone)

  const { data } = await admin
    .from('content_items')
    .select('text')
    .eq('kind', 'welcome')
    .eq('enabled', true)
  if (!data || data.length === 0) return null

  const idx = Math.floor(hashToUnit(`${spaceId}:welcome:${date}`) * data.length)
  return data[idx]?.text ?? data[0]!.text
}

/** space 時區的當地日期（YYYY-MM-DD）。en-CA 直接給這個格式。 */
function localDate(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
