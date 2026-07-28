'use client'

import { useActionState, useState } from 'react'
import type { SettingsActionState } from './actions'

/**
 * 天氣設定（#56）。預設關閉；只填城市「名稱」（不存座標）。
 * 「使用目前位置」：向瀏覽器要定位 → POST /api/weather/lookup（座標只在 body）→ 反查城市名填入。
 * 使用者拒絕定位時給提示、不中斷（誠實降級）。
 */
export function WeatherSettings({
  spaceId,
  canEdit,
  initial,
  action,
}: {
  spaceId: string
  canEdit: boolean
  initial: { enabled: boolean; city: string }
  action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>
}) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' })
  const [city, setCity] = useState(initial.city)
  const [locating, setLocating] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  function useMyLocation() {
    setHint(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setHint('這個瀏覽器不支援定位，請直接輸入城市。')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            const res = await fetch('/api/weather/lookup', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
              body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            })
            const body = (await res.json()) as { data?: { found?: boolean; city?: string } }
            if (res.ok && body.data?.found && body.data.city) {
              setCity(body.data.city)
              setHint('已用你目前的位置填入城市，記得按儲存。')
            } else {
              setHint('找不到你所在的城市名稱，請手動輸入。')
            }
          } catch {
            setHint('定位查詢失敗，請手動輸入城市。')
          } finally {
            setLocating(false)
          }
        })()
      },
      () => {
        setLocating(false)
        setHint('沒有取得定位權限，請直接輸入城市名稱。')
      },
      { timeout: 10000 },
    )
  }

  return (
    <form action={formAction} className="sr-stack">
      <input type="hidden" name="spaceId" value={spaceId} />

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={!canEdit || pending}>
        <div style={{ display: 'flex', gap: 'var(--sr-space-3)', padding: 'var(--sr-space-2) 0' }}>
          <input
            type="checkbox"
            id="weatherEnabled"
            name="weatherEnabled"
            defaultChecked={initial.enabled}
            style={{ marginTop: 6, width: 18, height: 18, flexShrink: 0 }}
            aria-describedby="weatherEnabled-desc"
          />
          <div style={{ minWidth: 0 }}>
            <label htmlFor="weatherEnabled" style={{ fontWeight: 600, cursor: 'pointer' }}>
              顯示天氣
            </label>
            <p className="sr-muted" id="weatherEnabled-desc" style={{ margin: 0 }}>
              打開後，天氣小工具會依你設定的城市顯示目前天氣。座標不會被儲存，只留城市名稱。
            </p>
          </div>
        </div>

        <div className="sr-field" style={{ marginTop: 'var(--sr-space-2)' }}>
          <label className="sr-label" htmlFor="weatherCity">
            城市
          </label>
          <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
            <input
              className="sr-input"
              id="weatherCity"
              name="weatherCity"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="例如：台北"
              maxLength={80}
              autoComplete="off"
              style={{ flex: '1 1 12rem', minWidth: 0 }}
            />
            <button
              type="button"
              className="sr-button sr-button-secondary"
              onClick={useMyLocation}
              disabled={locating}
              style={{ flexShrink: 0 }}
            >
              {locating ? '定位中…' : '使用目前位置'}
            </button>
          </div>
          {hint && (
            <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0' }} role="status">
              {hint}
            </p>
          )}
        </div>
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
