'use client'

import { useActionState } from 'react'
import { updateBirthday, type SettingsActionState } from './actions'

const initial: SettingsActionState = { status: 'idle' }

/**
 * 生日（選填，只存月/日）。有填就在生日當天收到祝福通知；留空就不會。
 */
export function BirthdayForm({
  spaceId,
  month,
  day,
}: {
  spaceId: string
  month: number | null
  day: number | null
}) {
  const [state, formAction, pending] = useActionState(updateBirthday, initial)

  return (
    <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
      <input type="hidden" name="spaceId" value={spaceId} />
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'end', flexWrap: 'wrap' }}>
        <label className="sr-field" style={{ maxWidth: 120 }}>
          <span>月（選填）</span>
          <input
            className="sr-input"
            name="month"
            type="number"
            min={1}
            max={12}
            defaultValue={month ?? ''}
            placeholder="例如 7"
          />
        </label>
        <label className="sr-field" style={{ maxWidth: 120 }}>
          <span>日</span>
          <input
            className="sr-input"
            name="day"
            type="number"
            min={1}
            max={31}
            defaultValue={day ?? ''}
            placeholder="例如 24"
          />
        </label>
        <button type="submit" className="sr-button sr-button-secondary" disabled={pending}>
          {pending ? '儲存中…' : '儲存'}
        </button>
      </div>
      {state.status === 'error' && state.message && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          ✕ {state.message}
        </p>
      )}
      {state.status === 'saved' && state.message && (
        <p className="sr-message sr-message-success" role="status" style={{ margin: 0 }}>
          ✓ {state.message}
        </p>
      )}
      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        只存月和日、不存年（祝生日快樂不用知道年齡）。留空就不會收到生日通知。
      </p>
    </form>
  )
}
