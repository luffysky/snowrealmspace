'use client'

import { useActionState, useState } from 'react'
import { deleteSpace, deleteAccount, type SettingsActionState } from './actions'

const initial: SettingsActionState = { status: 'idle' }

/**
 * 危險區域：刪除整個空間，或刪除整個帳號。
 *
 * 刪除空間：軟刪除 + 7 天寬限（期間可還原），需完整輸入空間名稱。
 * 刪除帳號：立即且不可逆（含名下所有 space），需輸入登入 email。
 */
export function DangerZone({
  spaceId,
  spaceName,
  userEmail,
}: {
  spaceId: string
  spaceName: string
  userEmail: string | null
}) {
  return (
    <>
      <DeleteSpace spaceId={spaceId} spaceName={spaceName} />
      {userEmail && <DeleteAccount userEmail={userEmail} />}
    </>
  )
}

function DeleteSpace({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const [state, formAction, pending] = useActionState(deleteSpace, initial)
  const [confirm, setConfirm] = useState('')
  const armed = confirm.trim() === spaceName

  return (
    <section className="sr-card sr-danger-zone">
      <h2 className="sr-section-title">刪除整個空間</h2>
      <p className="sr-muted" style={{ marginTop: 0 }}>
        刪除後這個空間<strong>立刻進不去</strong>，並在 <strong>7 天後永久清除</strong>
        （檔案先從雲端儲存刪除，再刪資料）。7 天內你再次登入可以還原。
        逐項資料也可以在上面的清單分別刪除。
      </p>

      {state.status === 'error' && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          ✕ {state.message}
        </p>
      )}

      <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        <input type="hidden" name="spaceId" value={spaceId} />
        <label className="sr-field">
          <span>
            請輸入空間名稱「<strong>{spaceName}</strong>」以確認
          </span>
          <input
            className="sr-input"
            name="confirmName"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={spaceName}
          />
        </label>
        <div className="sr-btn-row">
          <button type="submit" className="sr-button sr-button-danger" disabled={!armed || pending}>
            {pending ? '刪除中…' : '刪除這個空間'}
          </button>
        </div>
      </form>
    </section>
  )
}

function DeleteAccount({ userEmail }: { userEmail: string }) {
  const [state, formAction, pending] = useActionState(deleteAccount, initial)
  const [confirm, setConfirm] = useState('')
  const armed = confirm.trim().toLowerCase() === userEmail.toLowerCase()

  return (
    <section className="sr-card sr-danger-zone">
      <h2 className="sr-section-title">刪除整個帳號</h2>
      <p className="sr-muted" style={{ marginTop: 0 }}>
        這會<strong>立刻且不可逆</strong>地刪除你的帳號與<strong>名下所有空間的全部資料</strong>
        （檔案先從雲端儲存刪除，再刪資料），沒有寬限、無法還原。確定要刪，請輸入你的登入 email。
      </p>

      {state.status === 'error' && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          ✕ {state.message}
        </p>
      )}

      <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        <label className="sr-field">
          <span>
            輸入登入 email「<strong>{userEmail}</strong>」以確認
          </span>
          <input
            className="sr-input"
            name="confirmEmail"
            type="email"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={userEmail}
          />
        </label>
        <div className="sr-btn-row">
          <button type="submit" className="sr-button sr-button-danger" disabled={!armed || pending}>
            {pending ? '刪除中…' : '永久刪除我的帳號'}
          </button>
        </div>
      </form>
    </section>
  )
}
