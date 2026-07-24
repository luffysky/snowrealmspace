'use client'

import { useActionState } from 'react'
import { updateBackgroundAudio, type SettingsActionState } from './actions'

const initial: SettingsActionState = { status: 'idle' }

export type AudioOption = { id: string; label: string }

/**
 * 背景音樂設定（Luffy 追加）。使用者自己決定要不要加、加哪一首。
 * 播放受瀏覽器 autoplay 政策約束，不自動出聲 —— nav 上有播放按鈕。
 */
export function BackgroundMusicSettings({
  spaceId,
  canEdit,
  audioOptions,
  initial: init,
}: {
  spaceId: string
  canEdit: boolean
  audioOptions: AudioOption[]
  initial: { enabled: boolean; assetId: string | null; volume: number }
}) {
  const [state, formAction, pending] = useActionState(updateBackgroundAudio, initial)

  return (
    <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-4)' }}>
      <input type="hidden" name="spaceId" value={spaceId} />

      {audioOptions.length === 0 ? (
        <p className="sr-muted">
          還沒有音樂檔。先到 Library 上傳一段音訊（mp3／ogg／wav，500MB 內），這裡就能選。
        </p>
      ) : (
        <>
          <label className="sr-choice">
            <input type="checkbox" name="enabled" defaultChecked={init.enabled} disabled={!canEdit || pending} />
            開啟背景音樂
          </label>

          <div>
            <label className="sr-label" htmlFor="bgm-asset">
              選擇音樂
            </label>
            <select
              id="bgm-asset"
              name="assetId"
              className="sr-input"
              defaultValue={init.assetId ?? ''}
              disabled={!canEdit || pending}
            >
              <option value="">— 無 —</option>
              {audioOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="sr-label" htmlFor="bgm-volume">
              音量
            </label>
            <input
              id="bgm-volume"
              type="range"
              name="volume"
              min={0}
              max={1}
              step={0.05}
              defaultValue={init.volume}
              disabled={!canEdit || pending}
            />
          </div>

          <p className="sr-muted" style={{ margin: 0 }}>
            瀏覽器規定音樂不能自動出聲：開啟後，導覽列會出現一個 ♪ 按鈕，點一下才開始播放。
          </p>
        </>
      )}

      {canEdit && (
        <button type="submit" className="sr-button" disabled={pending}>
          {pending ? '儲存中…' : '儲存'}
        </button>
      )}

      {state.status === 'saved' && (
        <p className="sr-message sr-message-success" role="status">
          {state.message}
        </p>
      )}
      {state.status === 'error' && (
        <p className="sr-message sr-message-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
