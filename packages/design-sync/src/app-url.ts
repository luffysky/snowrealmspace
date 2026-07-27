/**
 * 對外網址基底（package 版）。與 apps/web/lib/app-url 同語意，但只讀 env、不依賴 web，
 * 這樣 worker 與 web 都能用。見 apps/web/lib/app-url.ts 的說明。
 */
export function appUrl(): string {
  const url = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return url.replace(/\/+$/, '')
}
