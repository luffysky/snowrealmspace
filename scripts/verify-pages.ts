/** 認證後載入所有新頁面，確認 200 且不含 Next.js 錯誤標記（執行期 render 驗證）。 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createUserClient } from '@snowrealm/db/server'

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const GATE = 'sr-gate=granted-2607'

const jar = new Map<string, string>()
const client = createUserClient({
  getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  setAll: (toSet) => {
    for (const { name, value } of toSet) {
      if (value === '') jar.delete(name)
      else jar.set(name, value)
    }
  },
})

const { error } = await client.auth.signInWithPassword({ email: 'smoke@local.test', password: 'smoke-pass-1234' })
if (error) { console.error('登入失敗', error.message); process.exit(1) }

const cookieHeader = () => [GATE, ...[...jar.entries()].map(([n, v]) => `${n}=${v}`)].join('; ')

const PAGES = ['/home', '/library', '/projects', '/works', '/timeline', '/principles', '/surprises', '/insights', '/settings', '/settings/data', '/settings/memory', '/studio/theme', '/studio/background']
let bad = 0
for (const p of PAGES) {
  const res = await fetch(`${APP}${p}`, { headers: { cookie: cookieHeader() }, redirect: 'manual' })
  const html = res.status === 200 ? await res.text() : ''
  // Next.js 執行期錯誤會在 HTML 留下這些標記
  const hasError = /Application error: a server-side exception|__NEXT_ERROR|Internal Server Error|digest&quot;/.test(html)
  const okStatus = res.status === 200
  const mark = okStatus && !hasError ? '✓' : '✗'
  if (!okStatus || hasError) bad++
  console.log(`${mark} ${p.padEnd(20)} ${res.status}${hasError ? ' [含錯誤標記]' : ''}`)
}
console.log(bad === 0 ? '\n✅ 所有新頁面認證後正常 render' : `\n✗ ${bad} 個頁面有問題`)
process.exit(bad === 0 ? 0 : 1)
