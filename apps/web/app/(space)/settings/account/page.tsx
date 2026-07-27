import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser, requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { listIdentities, syncFromAuthIdentities } from '@snowrealm/db/identities'
import { lineConfig } from '@snowrealm/db/line-oauth'
import { LinkedAccounts } from './LinkedAccounts'
import { AvatarUpload } from './AvatarUpload'
import { CopyId } from './CopyId'
import { ChangePassword } from './ChangePassword'
import { accountIdentity } from '@/lib/auth/account-identity'
import { Avatar } from '@/components/Avatar'
import { resolveAvatarUrl } from '@/lib/avatar'

export const metadata: Metadata = { title: '登入方式 — SnowRealm-Space' }
export const dynamic = 'force-dynamic'

const ERROR_MESSAGE: Record<string, string> = {
  link_taken: '這個帳號已經連結到另一個 SnowRealm 帳號了。',
  link_failed: '連結失敗，請再試一次。',
  link_missing_code: '連結流程中斷了，請再試一次。',
  line_cancelled: '你在 LINE 那邊取消了授權。',
  line_state_invalid: '這個連結已經失效，請重新開始。',
  line_id_token_invalid: 'LINE 回傳的身分無法驗證，沒有完成連結。',
  line_nonce_mismatch: 'LINE 回傳的身分無法驗證，沒有完成連結。',
  line_token_exchange_failed: '無法向 LINE 取得授權，請再試一次。',
  line_start_failed: '無法開始 LINE 授權，請再試一次。',
  line_not_configured: 'LINE 登入尚未設定。需要先在 LINE Developers Console 建立 Login channel。',
  line_not_linked: '這個 LINE 帳號還沒綁定任何 SnowRealm 帳號。請先用 email 登入後在這裡綁定。',
}

/**
 * 登入方式管理。13-third-party-auth.md §5。
 *
 * 用 magic link 註冊的帳號，可以在這裡把 Google / LINE 綁上來，
 * 之後三種方式都能登入同一個帳號、看到同一個 space。
 */
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const { space } = await requireActiveSpace()
  const params = await searchParams

  // auth.identities 是權威來源，先同步再讀，
  // 否則剛綁完 Google 回來會看到舊清單。
  await syncFromAuthIdentities(user.id)
  const identities = await listIdentities(user.id)

  // 目前的大頭貼（asset id → 前端換 signed URL 顯示）
  const db = await getDb()
  const { data: profile } = await db
    .from('profiles')
    .select('avatar_asset_id')
    .eq('id', user.id)
    .maybeSingle()

  const errorKey = typeof params['error'] === 'string' ? params['error'] : null
  const linkedKey = typeof params['linked'] === 'string' ? params['linked'] : null
  const welcome = params['welcome'] === '1'

  // 純帳號註冊的合成 email 不對外顯示 —— 顯示帳號本身
  const acct = accountIdentity(user.email, user.username)
  const avatarSrc = await resolveAvatarUrl(db, profile?.avatar_asset_id ?? null)

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{welcome ? '歡迎！' : '登入方式'}</h1>
        <div className="sr-row" style={{ gap: 'var(--sr-space-3)', alignItems: 'center' }}>
          <Avatar src={avatarSrc} name={acct.value} size={44} />
          <p className="sr-muted" style={{ margin: 0 }}>
            {acct.label}：{acct.value}
          </p>
        </div>
      </section>

      {welcome && (
        <section className="sr-card sr-message-info" style={{ borderLeft: '4px solid var(--sr-accent)' }}>
          <h2 style={{ fontSize: 'var(--sr-text-lg)', marginTop: 0 }}>綁定其他登入方式</h2>
          <p className="sr-muted" style={{ marginTop: 0 }}>
            你已經可以用帳號密碼登入了。要的話，把 Google 或 LINE 綁上來，
            之後用哪一種進的都是同一個帳號、同一個空間。也可以之後再綁。
          </p>
          <a className="sr-button sr-button-secondary" href="/home">
            先跳過，直接進去
          </a>
        </section>
      )}

      {errorKey && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {ERROR_MESSAGE[errorKey] ?? '發生問題，請再試一次。'}
        </p>
      )}

      {linkedKey && (
        <p className="sr-message sr-message-success" role="status">
          ✓ 已綁定 {linkedKey === 'google' ? 'Google' : 'LINE'}。下次可以直接用它登入。
        </p>
      )}

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>大頭貼</h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          上傳一張圖片當你的頭像。存進你空間的媒體庫（Library），只有你看得到。
        </p>
        <AvatarUpload spaceId={space.id} initialAssetId={profile?.avatar_asset_id ?? null} />
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>
          可以用來登入這個帳號的方式
        </h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          綁定之後，這些方式進的是 <strong>同一個</strong> 帳號、同一個空間，不會變成兩個帳號。
        </p>

        <LinkedAccounts
          initial={identities}
          googleAvailable={Boolean(process.env['GOOGLE_OAUTH_CLIENT_ID'])}
          lineAvailable={lineConfig() !== null}
        />
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>更改密碼</h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          知道目前的密碼就能在這裡直接換新的。忘記密碼要另外走重設（需要綁定的真信箱）。
        </p>
        <ChangePassword />
      </section>

      <section className="sr-card">
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginBottom: 'var(--sr-space-2)' }}>會員資料</h2>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
          以 UUID 記身分（OAuth 綁定前的識別）。需要對帳或客服時用得到。
        </p>
        <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
          <CopyId label="使用者 ID" value={user.id} />
          <CopyId label="空間 ID" value={space.id} />
        </div>
      </section>

      <p className="sr-muted">
        <Link href="/settings">← 回到設定</Link>
      </p>
    </div>
  )
}
