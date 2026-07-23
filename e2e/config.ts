/**
 * E2E 的固定 base URL。
 *
 * **不要用 `NEXT_PUBLIC_APP_URL`。** 那是開發用的 :3000；
 * E2E 跑在自己的 :3100（獨立 build，與 dev server 隔離）。
 * 用錯會讓測試偷偷打到 dev server —— 表面上通過，
 * 但驗證的不是這次要測的產物；dev server 一關就整批 ERR_CONNECTION_REFUSED。
 */
export const E2E_PORT = 3100
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
