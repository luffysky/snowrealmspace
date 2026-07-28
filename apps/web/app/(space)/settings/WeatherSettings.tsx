'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { SettingsActionState } from './actions'
import { TW_REGIONS } from '@/lib/weather/tw-regions'

/**
 * 天氣設定（#56）。預設關閉；只填城市「名稱」（不存座標）。
 *
 * 資料流（重要）：地理編碼一律由**瀏覽器**直接打 Open-Meteo，伺服器不代打 —— 因為
 * Zeabur gateway 連 Open-Meteo 不穩會 502，而瀏覽器連得到（公開＋開放 CORS）。
 *
 * 城市欄是**自動完成搜尋**：邊打字（debounce ~300ms、至少 2 字）邊向 Open-Meteo 的
 * geocoding 端點要建議清單（涵蓋台灣縣市/區、外島與國外城市，名稱在地化 zh）。選一筆就把
 * weather_city 設成該城市的正規 name。欄位同時**接受自由輸入**：沒選建議時 Enter / 失焦保留你打的字。
 *
 * 「使用目前位置」：向瀏覽器要定位 → 瀏覽器直接打 BigDataCloud 反向地理編碼（免金鑰）換城市名填入。
 * 座標只在瀏覽器端使用、不送到我們的伺服器，也不儲存。使用者拒絕定位時給提示、不中斷（誠實降級）。
 */

/** 搜尋建議（只含前端要顯示的欄位；座標不落地）。 */
type Suggestion = { name: string; admin1?: string; country?: string; displayName: string }

/** 搜尋狀態：誠實呈現搜尋中 / 查無結果 / 錯誤，不靜默失敗。 */
type SearchStatus = 'idle' | 'searching' | 'done' | 'no-results' | 'error'

// Open-Meteo 地理編碼（公開、開放 CORS、免金鑰）與 BigDataCloud 反向地理編碼（免金鑰）。
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
// 瀏覽器端逾時：不經 gateway，可放寬（6s）。
const CLIENT_TIMEOUT_MS = 6000

type GeoRaw = {
  results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[]
}
type ReverseRaw = { city?: string; locality?: string; principalSubdivision?: string }

/**
 * 「信義區, 臺灣」這樣的顯示字串（mirror @snowrealm/weather 的 displayPlace，純字串組裝）。
 * 有行政區就帶上、去重；最多兩段避免過長。
 */
function displayPlace(name: string, admin1?: string, country?: string): string {
  const parts = [name, admin1, country].filter(
    (x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i,
  )
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ')
}

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

  // 縣市→區 下拉：只管「縣市」選了誰，區清單由它推出。選定區才寫回共用的 city 欄。
  const [twCity, setTwCity] = useState('')
  const twDistricts = TW_REGIONS.find((r) => r.city === twCity)?.districts ?? []
  // 目前 city 若剛好是這個縣市的某個區，讓區下拉回填該選項；否則顯示未選。
  const twDistrictValue = twDistricts.includes(city) ? city : ''

  // 自動完成狀態
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [activeIndex, setActiveIndex] = useState(-1)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listboxId = 'weatherCity-listbox'

  // 卸載時清掉待處理的 debounce / 請求，避免 setState-after-unmount。
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function closeList() {
    setOpen(false)
    setActiveIndex(-1)
  }

  /** debounce 排程一次搜尋；少於 2 字直接收起清單、不打上游。 */
  function scheduleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      setStatus('idle')
      closeList()
      return
    }
    setStatus('searching')
    setOpen(true)
    setActiveIndex(-1)
    debounceRef.current = setTimeout(() => {
      void runSearch(q)
    }, 300)
  }

  async function runSearch(query: string) {
    // 瀏覽器直接打 Open-Meteo geocoding（不經我們的伺服器 → 不會 502）。
    // 用 AbortController 取消上一筆（打了新字），另加逾時避免卡住。
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)])
    try {
      const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=8&language=zh&format=json`
      const res = await fetch(url, { signal })
      if (!res.ok) {
        setSuggestions([])
        setStatus('error')
        setOpen(true)
        return
      }
      const body = (await res.json()) as GeoRaw
      // 只保留前端要顯示的欄位（座標不落地）；顯示字串比照 widget/provider。
      const list: Suggestion[] = (body.results ?? []).map((r) => ({
        name: r.name,
        ...(r.admin1 ? { admin1: r.admin1 } : {}),
        ...(r.country ? { country: r.country } : {}),
        displayName: displayPlace(r.name, r.admin1, r.country),
      }))
      setSuggestions(list)
      setStatus(list.length === 0 ? 'no-results' : 'done')
      setOpen(true)
    } catch (err) {
      // AbortController 取消（打了新字）不是錯誤，忽略。
      if (err instanceof DOMException && err.name === 'AbortError') return
      setSuggestions([])
      setStatus('error')
      setOpen(true)
    }
  }

  function onCityChange(value: string) {
    setCity(value)
    scheduleSearch(value)
  }

  /** 選一筆建議：存正規城市 name（之後 weatherForCity 反查最穩），收起清單。 */
  function selectSuggestion(s: Suggestion) {
    setCity(s.name)
    setSuggestions([])
    setStatus('idle')
    closeList()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      if (!open && suggestions.length > 0) {
        setOpen(true)
        setActiveIndex(0)
      } else if (suggestions.length > 0) {
        setActiveIndex((i) => (i + 1) % suggestions.length)
      }
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
        e.preventDefault()
      }
    } else if (e.key === 'Enter') {
      // 有選中的建議 → 採用它（別讓表單送出）；否則保留自由輸入，讓表單照常送出。
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex])
        e.preventDefault()
      } else if (open) {
        closeList()
      }
    } else if (e.key === 'Escape') {
      if (open) {
        closeList()
        e.preventDefault()
      }
    }
  }

  function useMyLocation() {
    setHint(null)
    closeList()
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setHint('這個瀏覽器不支援定位，請直接輸入城市。')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          try {
            // 瀏覽器直接打 BigDataCloud 反向地理編碼（免金鑰）。座標只在瀏覽器端使用，
            // 不送到我們的伺服器、不儲存 —— 只把換算出的城市名填入欄位。
            const url =
              `${REVERSE_URL}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}` +
              '&localityLanguage=zh'
            const res = await fetch(url, { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) })
            const body = (await res.json()) as ReverseRaw
            const name = body.city || body.locality || body.principalSubdivision || null
            if (res.ok && name) {
              setCity(name)
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

  const showList = open && (status === 'searching' || status === 'error' || suggestions.length > 0 || status === 'no-results')

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
          <span className="sr-label">城市</span>

          {/* 方式一：台灣縣市／區 下拉（純靜態資料、不外呼）。選定區 → 寫回下方的 weather_city。 */}
          <p
            className="sr-muted"
            id="twRegion-desc"
            style={{ margin: '0 0 var(--sr-space-1)', fontSize: 'var(--sr-text-sm)' }}
          >
            用下拉選（台灣縣市／區）
          </p>
          <div
            className="sr-row"
            style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', marginBottom: 'var(--sr-space-3)' }}
          >
            <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
              <label className="sr-label" htmlFor="twCity" style={{ fontSize: 'var(--sr-text-sm)' }}>
                縣市
              </label>
              <select
                id="twCity"
                className="sr-input"
                value={twCity}
                aria-describedby="twRegion-desc"
                onChange={(e) => {
                  // 只換縣市、還沒選區：先不動 weather_city，等使用者選到區再寫回。
                  setTwCity(e.target.value)
                  closeList()
                }}
                style={{ width: '100%', minWidth: 0 }}
              >
                <option value="">請選擇縣市…</option>
                {TW_REGIONS.map((r) => (
                  <option key={r.city} value={r.city}>
                    {r.city}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
              <label
                className="sr-label"
                htmlFor="twDistrict"
                style={{ fontSize: 'var(--sr-text-sm)' }}
              >
                區／鄉／鎮／市
              </label>
              <select
                id="twDistrict"
                className="sr-input"
                value={twDistrictValue}
                disabled={!canEdit || pending || twCity === ''}
                onChange={(e) => {
                  const d = e.target.value
                  if (d) {
                    // 只存區名（例如「板橋區」）：Open-Meteo geocode 是單一地名比對，
                    // 附上縣市反而比對不到，故不加縣市字尾。
                    setCity(d)
                    setHint(null)
                    setSuggestions([])
                    setStatus('idle')
                    closeList()
                  }
                }}
                style={{ width: '100%', minWidth: 0 }}
              >
                <option value="">{twCity ? '請選擇區…' : '先選縣市'}</option>
                {twDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 方式二：自由輸入（含國外城市）＋ 使用目前位置。與下拉共用同一個 weather_city。 */}
          <label
            className="sr-label"
            htmlFor="weatherCity"
            style={{ fontSize: 'var(--sr-text-sm)' }}
          >
            或直接輸入城市（含國外）
          </label>
          <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
            {/* 相對定位容器：下拉清單絕對定位在輸入框正下方、跟著它的寬度（RWD 安全）。 */}
            <div style={{ position: 'relative', flex: '1 1 12rem', minWidth: 0 }}>
              <input
                className="sr-input"
                id="weatherCity"
                name="weatherCity"
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setOpen(true)
                }}
                onBlur={() => {
                  // 延遲收起，讓點選建議（mousedown 已 preventDefault）先完成。
                  setTimeout(closeList, 120)
                }}
                placeholder="例如：台北、澎湖、Tokyo"
                maxLength={80}
                autoComplete="off"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? `weatherCity-opt-${activeIndex}` : undefined}
                style={{ width: '100%', minWidth: 0 }}
              />

              {showList && (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="城市搜尋建議"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    maxHeight: '16rem',
                    overflowY: 'auto',
                    margin: 0,
                    padding: 'var(--sr-space-1)',
                    listStyle: 'none',
                    zIndex: 20,
                    background: 'var(--sr-surface)',
                    border: '1px solid var(--sr-border)',
                    borderRadius: 'var(--sr-radius-md)',
                    boxShadow: 'var(--sr-shadow-md)',
                  }}
                >
                  {status === 'searching' && (
                    <li className="sr-muted" role="status" style={{ padding: 'var(--sr-space-2)' }}>
                      搜尋中…
                    </li>
                  )}
                  {status === 'error' && (
                    <li
                      role="status"
                      style={{ padding: 'var(--sr-space-2)', color: 'var(--sr-danger)' }}
                    >
                      搜尋失敗，稍後再試，或直接輸入城市名稱。
                    </li>
                  )}
                  {status === 'no-results' && (
                    <li className="sr-muted" role="status" style={{ padding: 'var(--sr-space-2)' }}>
                      找不到符合的城市，可直接輸入你要的名稱。
                    </li>
                  )}
                  {(status === 'done' || suggestions.length > 0) &&
                    suggestions.map((s, i) => (
                      <li
                        key={`${s.name}-${s.displayName}-${i}`}
                        id={`weatherCity-opt-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseDown={(e) => e.preventDefault() /* 別讓 input 先失焦 */}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => selectSuggestion(s)}
                        style={{
                          padding: 'var(--sr-space-2)',
                          borderRadius: 'var(--sr-radius-sm)',
                          cursor: 'pointer',
                          minWidth: 0,
                          overflowWrap: 'anywhere',
                          background: i === activeIndex ? 'var(--sr-surface-hover)' : 'transparent',
                        }}
                      >
                        {s.displayName}
                      </li>
                    ))}
                </ul>
              )}
            </div>

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
