'use client'

import { useActionState } from 'react'
import type { SettingsActionState } from './actions'

type Toggle = {
  name: string
  label: string
  description: string
  defaultChecked: boolean
}

export function PrivacyToggles({
  spaceId,
  canEdit,
  initial,
  action,
}: {
  spaceId: string
  canEdit: boolean
  initial: {
    activityTracking: boolean
    memoryEnabled: boolean
    aiAnalysisEnabled: boolean
    providerDataEnabled: boolean
  }
  action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>
}) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' })

  const toggles: Toggle[] = [
    {
      name: 'activityTracking',
      label: '記錄我的活動',
      description: '用來建立時間軸與洞察。關閉後不再記錄新活動，已記錄的會保留。',
      defaultChecked: initial.activityTracking,
    },
    {
      name: 'memoryEnabled',
      label: '允許 Agent 記住事情',
      description: '關閉時 Agent 不會提議記住任何事，也不會引用既有記憶。',
      defaultChecked: initial.memoryEnabled,
    },
    {
      name: 'aiAnalysisEnabled',
      label: '允許 AI 分析我的作品',
      description: '關閉時仍可看到系統本地計算的數據，只是不會有 AI 的判讀。',
      defaultChecked: initial.aiAnalysisEnabled,
    },
    {
      name: 'providerDataEnabled',
      label: '允許連接外部設計軟體',
      description: '關閉時所有既有連線會暫停，不再接收更新。',
      defaultChecked: initial.providerDataEnabled,
    },
  ]

  return (
    <form action={formAction} className="sr-stack">
      <input type="hidden" name="spaceId" value={spaceId} />

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={!canEdit || pending}>
        <legend className="sr-label" style={{ padding: 0 }}>
          隱私控制
        </legend>

        {toggles.map((t) => (
          <div
            key={t.name}
            style={{
              display: 'flex',
              gap: 'var(--sr-space-3)',
              padding: 'var(--sr-space-4) 0',
              borderBottom: 'var(--sr-border-width) solid var(--sr-border)',
            }}
          >
            <input
              type="checkbox"
              id={t.name}
              name={t.name}
              defaultChecked={t.defaultChecked}
              style={{ marginTop: 6, width: 18, height: 18, flexShrink: 0 }}
              aria-describedby={`${t.name}-desc`}
            />
            <div>
              <label htmlFor={t.name} style={{ fontWeight: 600, cursor: 'pointer' }}>
                {t.label}
              </label>
              <p className="sr-muted" id={`${t.name}-desc`} style={{ margin: 0 }}>
                {t.description}
              </p>
            </div>
          </div>
        ))}
      </fieldset>

      {state.status === 'error' && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {state.message}
        </p>
      )}
      {state.status === 'saved' && (
        <p className="sr-message sr-message-success" role="status">
          ✓ {state.message}
        </p>
      )}

      {canEdit ? (
        <button className="sr-button" type="submit" disabled={pending}>
          {pending ? '儲存中…' : '儲存'}
        </button>
      ) : (
        <p className="sr-message sr-message-info">ⓘ 只有空間擁有者可以修改這些設定。</p>
      )}
    </form>
  )
}
