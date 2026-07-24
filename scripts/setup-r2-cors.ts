/**
 * 設定 Cloudflare R2 bucket 的 CORS，讓瀏覽器可以直傳（預簽 PUT）與直讀（預簽 GET）。
 *
 * 為什麼需要：上傳走「瀏覽器 → R2 直傳」（不經我們伺服器，見 Uploader.tsx）。
 * 這是跨網域請求，R2 bucket 沒設 CORS 的話，瀏覽器會在 preflight 就擋下來，
 * XHR 收到 error 事件 → 前端顯示「網路中斷」。（R2 用 Cloudflare 建，CORS 不會自動有。）
 *
 * 冪等：直接覆寫成這份 CORS 設定。允許的來源預設取 NEXT_PUBLIC_APP_URL + localhost，
 * 也可用參數覆寫：pnpm tsx scripts/setup-r2-cors.ts https://a.com https://b.com
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { setBucketCors } from '@snowrealm/storage'

const originsFromArgs = process.argv.slice(2).filter((a) => a.startsWith('http'))
const origins = Array.from(
  new Set(
    originsFromArgs.length > 0
      ? originsFromArgs
      : [process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ''), 'http://localhost:3000'].filter(
          (v): v is string => Boolean(v),
        ),
  ),
)

async function main() {
  console.log(`bucket: ${process.env.R2_BUCKET}`)
  console.log(`允許來源: ${origins.join(', ')}`)
  const applied = await setBucketCors(origins)
  console.log(`\n✓ CORS 已設定。目前允許的來源：${applied.join(', ')}`)
  console.log('重新整理頁面再試上傳即可。若正式站網域不在上面，用參數重跑。')
}

function dashboardHelp() {
  const json = JSON.stringify(
    [
      {
        AllowedOrigins: origins,
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
    null,
    2,
  )
  console.error(
    '\n這把 R2 token 只有物件（Object）讀寫權限，不能改 bucket CORS，所以 API 回 Access Denied。',
  )
  console.error('兩條路，二選一：\n')
  console.error(
    'A) 到 Cloudflare 手動貼（最快）：R2 → 點進 bucket「' +
      (process.env.R2_BUCKET ?? '') +
      '」→ Settings → CORS policy → Edit，貼上：\n',
  )
  console.error(json)
  console.error(
    '\nB) 建一把「Admin Read & Write」的 R2 API token，換掉 .env.local 的 R2_ACCESS_KEY_ID/SECRET 後，重跑這支腳本。',
  )
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('✗ 設定 CORS 失敗：', msg)
  if (/access denied|forbidden|not authorized/i.test(msg)) dashboardHelp()
  process.exit(1)
})
