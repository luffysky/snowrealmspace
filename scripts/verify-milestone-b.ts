/**
 * Milestone B 閉環驗證（上傳 + 主題部分）。
 *
 * 「使用者能上傳圖片、從它生成主題、自訂顏色、套用，
 *   關掉瀏覽器再打開，空間仍是他布置的樣子。」
 *
 * 走真實的 HTTP 路徑，含真實的 R2 直傳與 worker 處理。
 * 前提：supabase stack、web dev server (:3000)、worker 都在跑。
 */
import { createHash } from 'node:crypto'
import { config } from 'dotenv'

config({ path: '.env.local' })

const { createAdminClient } = await import('@snowrealm/db/server')
const { createInvite, provisionSpaceForUser } = await import('@snowrealm/db/provisioning')
const { analyzeTheme, themeDefinitionSchema } = await import('@snowrealm/theme-engine')

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const db = createAdminClient()

const results: { step: string; ok: boolean; detail?: string }[] = []
function record(step: string, ok: boolean, detail?: string) {
  results.push(detail === undefined ? { step, ok } : { step, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`)
}

// ── 建立測試使用者與 space ──────────────────────────────
const email = `milestone-b-${Date.now()}@example.com`
const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`

const { data: created } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (!created.user) {
  console.error('無法建立測試使用者')
  process.exit(1)
}
const userId = created.user.id
const { spaceId } = await provisionSpaceForUser({ userId, email })
record('建立測試 space', Boolean(spaceId))

/**
 * 取得真實的 session cookie。
 *
 * 不自己組 cookie 字串 —— @supabase/ssr 的 cookie 名稱與編碼（含 chunking）
 * 是實作細節，猜錯就會得到「請先登入」而看不出原因。
 * 讓它自己寫進 jar，我們只負責序列化。
 */
const { createUserClient } = await import('@snowrealm/db/server')

const jar = new Map<string, string>()
const browserClient = createUserClient({
  getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  setAll: (toSet) => {
    for (const { name, value } of toSet) {
      if (value === '') jar.delete(name)
      else jar.set(name, value)
    }
  },
})

const { error: signInError } = await browserClient.auth.signInWithPassword({ email, password })
if (signInError) {
  console.error('登入失敗：', signInError.message)
  process.exit(1)
}

const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
record('取得 session cookie', jar.size > 0, `${jar.size} 個 cookie`)

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${APP}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-space-id': spaceId,
      cookie: cookieHeader,
      ...(init.headers ?? {}),
    },
  })
}

// ── 驗證授權：沒有 X-Space-Id 應被拒 ────────────────────
{
  const res = await fetch(`${APP}/api/assets`, { headers: { cookie: cookieHeader } })
  record('缺少 X-Space-Id 時被拒絕', res.status === 400 || res.status === 403, `HTTP ${res.status}`)
}

{
  const res = await fetch(`${APP}/api/assets`, {
    headers: { 'x-space-id': spaceId },
  })
  record('未登入時被拒絕', res.status === 401, `HTTP ${res.status}`)
}

// ── 產生一張測試 PNG（純程式產生，不依賴外部檔案）──────
const sharp = (await import('sharp')).default
const testImage = await sharp({
  create: { width: 400, height: 300, channels: 3, background: { r: 243, g: 167, b: 195 } },
})
  .composite([
    {
      input: await sharp({
        create: { width: 160, height: 120, channels: 3, background: { r: 40, g: 30, b: 60 } },
      })
        .png()
        .toBuffer(),
      top: 30,
      left: 40,
    },
  ])
  .png()
  .toBuffer()

const checksum = createHash('sha256').update(testImage).digest('hex')

// ── 1. 上傳意圖 ────────────────────────────────────────
const intentRes = await api('/api/assets/upload-intent', {
  method: 'POST',
  body: JSON.stringify({
    filename: 'test-pattern.png',
    mimeType: 'image/png',
    bytes: testImage.byteLength,
    checksum,
  }),
})
const intentBody = (await intentRes.json()) as {
  data?: { assetId: string; uploadUrl: string; headers: Record<string, string> }
  error?: { message: string }
}
record('取得上傳意圖', intentRes.ok, intentBody.error?.message ?? '')
if (!intentBody.data) {
  console.error('無法繼續')
  process.exit(1)
}
const { assetId, uploadUrl, headers: putHeaders } = intentBody.data

// ── 2. 直傳 ────────────────────────────────────────────
const putRes = await fetch(uploadUrl, {
  method: 'PUT',
  headers: putHeaders,
  body: new Uint8Array(testImage),
})
record('直傳到儲存服務', putRes.ok, `HTTP ${putRes.status}`)

// ── 3. 完成並驗證內容 ──────────────────────────────────
const completeRes = await api(`/api/assets/${assetId}/complete`, { method: 'POST' })
const completeBody = (await completeRes.json()) as {
  data?: { status: string; mimeType: string }
  error?: { message: string }
}
record(
  '完成上傳並通過內容驗證',
  completeRes.ok && completeBody.data?.status === 'ready',
  completeBody.error?.message ?? completeBody.data?.mimeType,
)

// ── 4. MIME 造假會被擋下 ───────────────────────────────
{
  const fakeChecksum = createHash('sha256').update(Buffer.from('not-a-real-video')).digest('hex')
  const fakeIntent = await api('/api/assets/upload-intent', {
    method: 'POST',
    body: JSON.stringify({
      filename: 'fake.mp4',
      mimeType: 'video/mp4',
      bytes: 16,
      checksum: fakeChecksum,
    }),
  })
  const fake = (await fakeIntent.json()) as {
    data?: { assetId: string; uploadUrl: string; headers: Record<string, string> }
  }

  if (fake.data) {
    await fetch(fake.data.uploadUrl, {
      method: 'PUT',
      headers: fake.data.headers,
      body: new Uint8Array(Buffer.from('not-a-real-video')),
    })
    const res = await api(`/api/assets/${fake.data.assetId}/complete`, { method: 'POST' })
    const body = (await res.json()) as { error?: { message: string } }
    record(
      '宣稱 mp4 但內容不符時被拒絕',
      res.status === 422,
      body.error?.message?.slice(0, 40),
    )
  } else {
    record('宣稱 mp4 但內容不符時被拒絕', false, '無法取得上傳意圖')
  }
}

// ── 5. 等待 worker 產生縮圖與分析 ──────────────────────
{
  const deadline = Date.now() + 30_000
  let ready = false
  let features: Record<string, unknown> | null = null

  while (Date.now() < deadline) {
    const { data } = await db
      .from('assets')
      .select('width, height, local_features')
      .eq('id', assetId)
      .maybeSingle()

    if (data?.width) {
      ready = true
      features = data.local_features as Record<string, unknown>
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  record('worker 回填尺寸', ready, ready ? '' : '30 秒內未完成（worker 有在跑嗎？）')

  const { data: renditions } = await db
    .from('asset_renditions')
    .select('role, bytes')
    .eq('asset_id', assetId)

  const roles = new Set((renditions ?? []).map((r) => r.role))
  record('產生縮圖', roles.has('thumbnail'))
  record('產生預覽圖', roles.has('preview'))

  const colors = (features?.['colors'] ?? null) as { dominant?: string; count?: number } | null
  record('本地取色完成', Boolean(colors?.dominant), colors?.dominant ?? '')
  record(
    '取色結果是可驗證的數值（ADR-012）',
    typeof colors?.count === 'number' && colors.count > 0,
    `${colors?.count ?? 0} 個叢集`,
  )
}

// ── 6. 從圖片生成主題 ──────────────────────────────────
let draftDefinition: unknown = null
{
  const started = Date.now()
  const res = await api('/api/themes/from-image', {
    method: 'POST',
    body: JSON.stringify({ assetId, variants: 3 }),
  })
  const elapsed = Date.now() - started
  const body = (await res.json()) as {
    data?: { drafts: { variant: string; definition: unknown; a11yReport: { passesAA: boolean } }[] }
    error?: { message: string }
  }

  record('從圖片生成主題', res.ok, body.error?.message ?? `${body.data?.drafts.length} 個變體`)
  record('生成在 3 秒內完成（v1.0 §42.1）', elapsed < 3000, `${elapsed}ms`)

  const drafts = body.data?.drafts ?? []
  record(
    '每個變體都通過 AA 對比',
    drafts.length > 0 && drafts.every((d) => d.a11yReport.passesAA),
    drafts.map((d) => `${d.variant}:${d.a11yReport.passesAA ? '✓' : '✗'}`).join(' '),
  )
  draftDefinition = drafts[0]?.definition ?? null
}

// ── 7. 儲存主題 ────────────────────────────────────────
let themeId = ''
{
  const res = await api('/api/themes', {
    method: 'POST',
    body: JSON.stringify({
      name: '測試主題',
      definition: draftDefinition,
      source: 'from_image',
      sourceAssetId: assetId,
    }),
  })
  const body = (await res.json()) as { data?: { id: string }; error?: { message: string } }
  themeId = body.data?.id ?? ''
  record('儲存主題', res.status === 201 && Boolean(themeId), body.error?.message ?? '')
}

// ── 8. 注入防護（ADR-020）─────────────────────────────
{
  const evil = structuredClone(draftDefinition) as { colors: Record<string, string> }
  evil.colors['primary'] = 'url(javascript:alert(1))'
  const res = await api('/api/themes', {
    method: 'POST',
    body: JSON.stringify({ name: '惡意主題', definition: evil, source: 'manual' }),
  })
  record('拒絕含注入內容的主題', res.status === 400, `HTTP ${res.status}`)
}

// ── 9. 套用主題並確認持久化 ────────────────────────────
{
  const res = await api(`/api/themes/${themeId}/apply`, { method: 'POST' })
  record('套用主題', res.ok, `HTTP ${res.status}`)

  const { data: space } = await db
    .from('spaces')
    .select('active_theme_id')
    .eq('id', spaceId)
    .maybeSingle()

  record('套用結果已持久化', space?.active_theme_id === themeId)
}

// ── 10. 版本快照與還原 ─────────────────────────────────
{
  const created = await api(`/api/themes/${themeId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ label: '第一版' }),
  })
  record('建立版本快照', created.status === 201)

  // 改一下顏色
  const modified = structuredClone(draftDefinition) as { colors: Record<string, string> }
  modified.colors['primary'] = '#123456'
  await api(`/api/themes/${themeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ definition: modified }),
  })

  const restored = await api(`/api/themes/${themeId}/versions/1/restore`, { method: 'POST' })
  const body = (await restored.json()) as { data?: { definition: { colors: { primary: string } } } }
  record(
    '還原到先前版本',
    restored.ok && body.data?.definition.colors.primary !== '#123456',
    body.data?.definition.colors.primary,
  )
}

// ── 11. 匯出與匯入往返 ─────────────────────────────────
{
  const exportRes = await api(`/api/themes/${themeId}/export`)
  const exported: unknown = await exportRes.json()
  record('匯出主題 JSON', exportRes.ok)

  const importRes = await api('/api/themes/import', {
    method: 'POST',
    body: JSON.stringify(exported),
  })
  const body = (await importRes.json()) as { data?: { id: string }; error?: { message: string } }
  record('匯入匯出的檔案', importRes.status === 201, body.error?.message ?? '')

  // 匯入的主題定義應與原本相同
  if (body.data?.id) {
    const { data: original } = await db
      .from('themes')
      .select('definition')
      .eq('id', themeId)
      .maybeSingle()
    const { data: imported } = await db
      .from('themes')
      .select('definition')
      .eq('id', body.data.id)
      .maybeSingle()

    record(
      '匯入後的定義與原本一致',
      JSON.stringify(original?.definition) === JSON.stringify(imported?.definition),
    )
  }
}

// ── 12. 對比報告已快取 ─────────────────────────────────
{
  const { data: theme } = await db
    .from('themes')
    .select('definition, a11y_report')
    .eq('id', themeId)
    .maybeSingle()

  const report = theme?.a11y_report as { passesAA?: boolean; pairs?: unknown[] } | null
  record('儲存時已算好對比報告', Array.isArray(report?.pairs) && report.pairs.length > 0)

  const parsed = themeDefinitionSchema.safeParse(theme?.definition)
  if (parsed.success) {
    const fresh = analyzeTheme(parsed.data)
    record('快取的報告與重算結果一致', fresh.passesAA === report?.passesAA)
  }
}

// ── 13. 刪除引用檢查 ───────────────────────────────────
{
  const res = await api(`/api/assets/${assetId}`, { method: 'DELETE' })
  const body = (await res.json()) as {
    error?: { details?: { references?: { label: string }[] } }
  }
  const refs = body.error?.details?.references ?? []
  record(
    '刪除被主題引用的圖片會先擋下',
    res.status === 409 && refs.length > 0,
    refs.map((r) => r.label).join('、'),
  )

  const cascadeRes = await api(`/api/assets/${assetId}?cascade=true`, { method: 'DELETE' })
  record('cascade 可強制刪除', cascadeRes.ok)

  const { data: asset } = await db
    .from('assets')
    .select('deleted_at')
    .eq('id', assetId)
    .maybeSingle()
  record('刪除是軟刪除（30 天可復原）', Boolean(asset?.deleted_at))
}

// ── 14. 跨 space 隔離 ──────────────────────────────────
{
  const otherEmail = `milestone-b-other-${Date.now()}@example.com`
  const { data: other } = await db.auth.admin.createUser({
    email: otherEmail,
    password,
    email_confirm: true,
  })
  const { spaceId: otherSpaceId } = await provisionSpaceForUser({
    userId: other.user!.id,
    email: otherEmail,
  })

  // 用自己的 session 去存取別人的 space
  const res = await fetch(`${APP}/api/themes`, {
    headers: { cookie: cookieHeader, 'x-space-id': otherSpaceId },
  })
  record('無法用他人的 space id 存取資料', res.status === 403, `HTTP ${res.status}`)

  await db.from('spaces').delete().eq('id', otherSpaceId)
  await db.auth.admin.deleteUser(other.user!.id)
}

// ── 清理 ───────────────────────────────────────────────
await db.from('spaces').delete().eq('id', spaceId)
await db.auth.admin.deleteUser(userId)

const failed = results.filter((r) => !r.ok)
console.log('')
console.log('─'.repeat(60))
console.log(`Milestone B（上傳 + 主題）：${results.length - failed.length}/${results.length} 通過`)
console.log('─'.repeat(60))

if (failed.length > 0) {
  console.error('\n失敗項目：')
  for (const f of failed) console.error(`  ✗ ${f.step}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
process.exit(0)
