/**
 * 後台基底路徑。集中在這裡：後台可藏在隨機碼後面（防掃描），配合 middleware 的 rewrite。
 *
 * 設定 env `ADMIN_SEGMENT`（例如某段隨機碼）→ 後台變成 `/<碼>/admin`，裸 `/admin` 回 404。
 * 沒設 → 維持 `/admin`（不會壞）。這是**伺服器端 env**（不加 NEXT_PUBLIC，不進 client bundle），
 * 所以隨機碼不會外洩到瀏覽器。
 *
 * 只在 server component / server 端引用（sidebar 入口是把算好的字串當 prop 傳給 client）。
 */
const seg = process.env.ADMIN_SEGMENT?.trim()

export const ADMIN_SEGMENT = seg && seg.length > 0 ? seg : null
export const ADMIN_BASE = ADMIN_SEGMENT ? `/${ADMIN_SEGMENT}/admin` : '/admin'
