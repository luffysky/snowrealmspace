'use client'

import { useActionState, useState } from 'react'
import { deleteSpace, type SettingsActionState } from './actions'

const initial: SettingsActionState = { status: 'idle' }

/**
 * 危險區域：刪除整個空間。
 *
 * 這是軟刪除 + 7 天寬限：按下後空間立刻進不去，但要滿 7 天才永久清除，
 * 期間登入會看到「還原」。需要**完整輸入空間名稱**才解鎖按鈕，避免手滑誤刪。
 */
export function DangerZone({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
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
