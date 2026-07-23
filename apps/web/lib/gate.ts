/**
 * 站台密碼閘門（尚未對外開放）。
 *
 * 進站要先輸入站台密碼才放行。這**不是**使用者認證（那是 Supabase magic link）——
 * 只是一層「還沒公開」的軟性遮罩，擋住路過的人。
 *
 * 密碼在伺服器端（/api/gate）比對，絕不進 client bundle。
 * 這裡只放 middleware 與 gate route 共用的 cookie 名稱與放行 token
 * （token 不是密碼本身）。
 */

export const GATE_COOKIE = 'sr-gate'

/**
 * 放行標記。通過密碼後 cookie 設成這個值，middleware 據此放行。
 * 不是密碼、也推不回密碼 —— 就算被看到也只是這一層軟遮罩失效。
 */
export const GATE_TOKEN = 'granted-2607'

/** cookie 有效期：30 天，免得一直重輸。 */
export const GATE_MAX_AGE = 30 * 24 * 60 * 60
