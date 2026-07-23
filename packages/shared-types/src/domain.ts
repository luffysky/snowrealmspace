/** ADR-006：space_id 是唯一租戶鍵；role 決定能做什麼。 */
export type SpaceRole = 'owner' | 'collaborator' | 'guest'

export type SpacePrivacy = 'private' | 'unlisted' | 'public'

export type ActorType = 'user' | 'agent' | 'system'

/**
 * ADR-018：flag key 是 union type 而非 string。
 * 拼錯會是編譯錯誤，不會默默回傳 false。
 */
export const FEATURE_FLAG_KEYS = [
  'figmaIntegration',
  'canvaConnect',
  'canvaApp',
  'adobeExpress',
  'photoshopPlugin',
  'publicPortfolio',
  'collaboration',
  'marketplace',
  'videoBackground',
  'semanticSearch',
  'weeklyRecap',
] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

/**
 * 產生的資料庫型別把 check 約束的欄位標成 string。
 * 這些 narrowing 函式是唯一該做轉換的地方 —— 不要在各處散落 `as SpaceRole`。
 * 遇到未知值時回退到最小權限，而不是拋錯：資料庫已有 check 約束，
 * 走到這裡代表 schema 與程式碼不同步，此時降級比中斷服務安全。
 */
export function toSpaceRole(value: string): SpaceRole {
  return value === 'owner' || value === 'collaborator' || value === 'guest' ? value : 'guest'
}

export function toSpacePrivacy(value: string): SpacePrivacy {
  return value === 'private' || value === 'unlisted' || value === 'public' ? value : 'private'
}
