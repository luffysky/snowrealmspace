import type { Metadata } from 'next'
import Link from 'next/link'
import { checkInvite } from '@snowrealm/db/provisioning'
import { getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { LoginForm } from '../login/LoginForm'
import { RestoreSpace } from './RestoreSpace'

export const metadata: Metadata = { title: '邀請 — SnowRealm Space' }

const REASONS: Record<string, string> = {
  not_found: '這個邀請連結無效。',
  expired: '這個邀請連結已過期。',
  already_accepted: '這個邀請已經被使用過了。',
  email_mismatch: '這個邀請是給另一個 email 的。',
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

  const token = first(params['token'])
  const state = first(params['state'])

  if (state === 'space-deleted') {
    const user = await getUser()
    let pending: { id: string; name: string; deleted_at: string | null } | null = null
    if (user) {
      const db = await getDb()
      const { data } = await db
        .from('spaces')
        .select('id, name, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      pending = data ?? null
    }

    const purgeDate =
      pending?.deleted_at != null
        ? new Date(new Date(pending.deleted_at).getTime() + 7 * 24 * 60 * 60 * 1000)
        : null

    return (
      <main className="sr-center">
        <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
          <h1 style={{ fontSize: 'var(--sr-text-h2)' }}>空間已排定刪除</h1>
          {pending ? (
            <>
              <p className="sr-muted">
                「<strong>{pending.name}</strong>」已進入刪除流程，
                {purgeDate
                  ? `將於 ${purgeDate.toLocaleDateString('zh-TW')} 永久清除`
                  : '將於 7 天後永久清除'}
                。在那之前你可以還原它，所有資料都會回來。
              </p>
              <RestoreSpace spaceId={pending.id} />
              <p style={{ marginTop: 'var(--sr-space-4)' }}>
                <Link className="sr-link" href="/login">
                  暫時離開
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="sr-muted">這個空間已被刪除或已超過還原寬限期。</p>
              <Link className="sr-button sr-button-secondary" href="/login">
                回到登入
              </Link>
            </>
          )}
        </div>
      </main>
    )
  }

  if (state === 'missing-space') {
    return (
      <main className="sr-center">
        <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
          <h1 style={{ fontSize: 'var(--sr-text-h2)' }}>你的空間還沒建立好</h1>
          <p className="sr-muted">
            上次建立過程沒有完成。請用原本的邀請連結再進入一次，或向邀請你的人索取新的連結。
          </p>
          <Link className="sr-button sr-button-secondary" href="/login">
            回到登入
          </Link>
        </div>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="sr-center">
        <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
          <h1 style={{ fontSize: 'var(--sr-text-h2)' }}>需要邀請連結</h1>
          <p className="sr-muted">SnowRealm Space 目前是邀請制。</p>
          <Link className="sr-button sr-button-secondary" href="/login">
            我已經有帳號
          </Link>
        </div>
      </main>
    )
  }

  const check = await checkInvite(token)

  if (!check.ok) {
    return (
      <main className="sr-center">
        <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
          <h1 style={{ fontSize: 'var(--sr-text-h2)' }}>邀請無法使用</h1>
          <p className="sr-message sr-message-error" role="alert">
            ✕ {REASONS[check.reason] ?? '這個邀請連結無法使用。'}
          </p>
          <Link className="sr-button sr-button-secondary" href="/login">
            回到登入
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-2)' }}>
          這裡是為你準備的
        </h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          這個邀請是給 <strong>{check.invite.email}</strong> 的。
          <br />
          輸入同一個 email，我們會寄一封登入信給你。
        </p>
        <LoginForm inviteToken={token} next="/home" error={null} />
      </div>
    </main>
  )
}
