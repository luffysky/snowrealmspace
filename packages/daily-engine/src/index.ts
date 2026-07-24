/**
 * @snowrealm/daily-engine —— Milestone E 的每日內容/驚喜/生日鏈/主動訊息/Insight 生成。
 *
 * 全部用 service role（createAdminClient）+ (spaceId, timeZone) 簽章，
 * 因此 web（開頁時生成）與 worker（cron 掃時區主動生成）都能呼叫同一份邏輯。
 */

export { type TodayContent, getTodayContent } from './service.js'
export { maybeGenerateProactive } from './proactive.js'
export {
  type Rarity,
  type SurpriseView,
  type ArchivedSurprise,
  DAILY_WEIGHTS,
  PITY_THRESHOLD,
  rarityLabel,
  getSurpriseState,
  openSurprise,
  listOpenedSurprises,
  setSurpriseFavorite,
  rareDrought,
} from './surprise.js'
export { type ChainAvailability, type ChainLinkView, getChainState } from './chain.js'
export {
  type Insight,
  generateInsights,
  listInsights,
  deleteInsight,
} from './insights.js'
