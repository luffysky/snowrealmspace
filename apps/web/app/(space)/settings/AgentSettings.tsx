'use client'

import { useActionState } from 'react'
import { updateAgentSettings, type SettingsActionState } from './actions'

const initial: SettingsActionState = { status: 'idle' }

/**
 * Agent 主動訊息與 Quiet hours 設定（Milestone E）。
 * 一鍵關閉 = 選「關閉」。Quiet hours 期間不主動說話。
 */
export function AgentSettings({
  spaceId,
  canEdit,
  initial: init,
}: {
  spaceId: string
  canEdit: boolean
  initial: { agentProactive: string; quietStart: string; quietEnd: string }
}) {
  const [state, formAction, pending] = useActionState(updateAgentSettings, initial)

  return (
    <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-4)' }}>
      <input type="hidden" name="spaceId" value={spaceId} />

      <div>
        <label className="sr-label" htmlFor="agentProactive">
          主動訊息
        </label>
        <select
          id="agentProactive"
          name="agentProactive"
          className="sr-input"
          defaultValue={init.agentProactive === 'off' ? 'off' : init.agentProactive === 'daily' ? 'daily' : 'important_only'}
          disabled={!canEdit || pending}
        >
          <option value="off">關閉 —— 完全不主動說話</option>
          <option value="important_only">只在重要時刻（里程碑）</option>
          <option value="daily">每天一句陪伴</option>
        </select>
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-sm)' }}>
          每天最多 3 則。所有訊息都會先過安全過濾。
        </p>
      </div>

      <div className="sr-row" style={{ gap: 'var(--sr-space-4)', flexWrap: 'wrap' }}>
        <div>
          <label className="sr-label" htmlFor="quietStart">
            安靜時段開始
          </label>
          <input
            id="quietStart"
            name="quietStart"
            type="time"
            className="sr-input"
            defaultValue={init.quietStart}
            disabled={!canEdit || pending}
          />
        </div>
        <div>
          <label className="sr-label" htmlFor="quietEnd">
            安靜時段結束
          </label>
          <input
            id="quietEnd"
            name="quietEnd"
            type="time"
            className="sr-input"
            defaultValue={init.quietEnd}
            disabled={!canEdit || pending}
          />
        </div>
      </div>
      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        這段時間內不會主動打擾（例如睡覺時間）。兩個都留空表示不設限。
      </p>

      {state.status === 'error' && state.message && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {state.message}
        </p>
      )}
      {state.status === 'saved' && (
        <p className="sr-message sr-message-success" role="status">
          ✓ 已儲存
        </p>
      )}

      {canEdit && (
        <button type="submit" className="sr-button" disabled={pending} style={{ alignSelf: 'flex-start' }}>
          {pending ? '儲存中…' : '儲存'}
        </button>
      )}
    </form>
  )
}
