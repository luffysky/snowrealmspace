/**
 * 這個部署對外的網址基底。
 *
 * 為什麼不能用 request 的 host（url.origin）：在容器／反向代理後面（Zeabur 等），
 * Next 收到的 request.url 常是容器內部位址（如 http://localhost:8080）。若用它組
 * 重導網址，magic link / 密碼重設回呼就會把使用者導到 :8080，而不是正式網域。
 *
 * APP_PUBLIC_URL 是**執行期** env（不含 NEXT_PUBLIC、不在 build 時 inline），
 * server 端讀得到；設了它就能即時修正、免重建。hosted 上 NEXT_PUBLIC_APP_URL 是
 * build 時 inline 的，build arg 沒帶對就會是錯的，所以優先用 APP_PUBLIC_URL。
 */
export function appUrl(): string {
  const url = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return url.replace(/\/+$/, '')
}
