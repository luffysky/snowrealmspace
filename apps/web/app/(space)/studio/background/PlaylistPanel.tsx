'use client'

import { useCallback, useState } from 'react'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import { ScheduleEditor } from './ScheduleEditor'
import type { Slot } from '@snowrealm/validation'

export type PlaylistItemRow = { id: string; position: number; background_item_id: string }

export type ScheduleSlot = {
  startHour: number
  endHour: number
  backgroundItemId: string
  label?: string
}

export type Playlist = {
  id: string
  name: string
  play_mode: string
  interval_seconds: number
  transition: string
  transition_ms: number
  schedule: { slots?: ScheduleSlot[] } | null
  is_active: boolean
  background_playlist_items: PlaylistItemRow[]
}

const PLAY_MODES: { value: string; label: string; description: string }[] = [
  { value: 'sequential', label: '依序', description: '依照排列順序輪播' },
  { value: 'random', label: '隨機', description: '每天隨機挑一張，當天不變' },
  { value: 'daily', label: '每日切換', description: '每天換一張' },
  { value: 'per_login', label: '每次登入', description: '每次進來換一張' },
  { value: 'hourly', label: '每小時', description: '每小時換一張' },
  { value: 'time_of_day', label: '依時段', description: '不同時間顯示不同背景' },
]

const TRANSITION_LABELS: Record<string, string> = {
  fade: '淡入淡出',
  blur_fade: '模糊淡入',
  zoom_fade: '縮放淡入',
}

export function PlaylistPanel({
  spaceId,
  playlists,
  backgrounds,
  transitions,
  onChange,
  onStatus,
}: {
  spaceId: string
  playlists: Playlist[]
  backgrounds: BackgroundItem[]
  transitions: readonly string[]
  onChange: (next: Playlist[]) => void
  onStatus: (message: string, isError?: boolean) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('我的幻燈片')

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-space-id': spaceId,
          ...(init?.headers ?? {}),
        },
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。',
        )
      }
      return (body as { data: unknown }).data
    },
    [spaceId],
  )

  async function reload() {
    const data = (await api('/api/background-playlists')) as Playlist[]
    onChange(data)
  }

  async function create() {
    setCreating(true)
    try {
      await api('/api/background-playlists', {
        method: 'POST',
        body: JSON.stringify({ name: newName, playMode: 'sequential', transition: 'fade' }),
      })
      await reload()
      onStatus('已建立播放清單。')
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '建立失敗。', true)
    } finally {
      setCreating(false)
    }
  }

  async function addItems(playlistId: string, backgroundItemIds: string[]) {
    try {
      await api(`/api/background-playlists/${playlistId}/items`, {
        method: 'POST',
        body: JSON.stringify({ backgroundItemIds }),
      })
      await reload()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '加入失敗。', true)
    }
  }

  async function removeItem(playlistId: string, itemId: string) {
    try {
      await api(`/api/background-playlists/${playlistId}/items?itemId=${itemId}`, {
        method: 'DELETE',
      })
      await reload()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '移除失敗。', true)
    }
  }

  /** 上下移動而非拖曳：鍵盤與觸控都能用，且不需要額外的拖曳函式庫。 */
  async function move(playlist: Playlist, itemId: string, direction: -1 | 1) {
    const sorted = [...playlist.background_playlist_items].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex((i) => i.id === itemId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= sorted.length) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved!)

    try {
      await api(`/api/background-playlists/${playlist.id}/items`, {
        method: 'PATCH',
        body: JSON.stringify({ orderedItemIds: reordered.map((i) => i.id) }),
      })
      await reload()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '排序失敗。', true)
    }
  }

  async function patch(playlistId: string, body: Record<string, unknown>, reloadAfter = true) {
    try {
      await api(`/api/background-playlists/${playlistId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (reloadAfter) await reload()
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '更新失敗。', true)
    }
  }

  async function activate(playlistId: string) {
    try {
      await api(`/api/background-playlists/${playlistId}/activate`, { method: 'POST' })
      await reload()
      onStatus('已啟用。回到 Home 就會看到。')
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '啟用失敗。', true)
    }
  }

  const unusedFor = (playlist: Playlist) =>
    backgrounds.filter(
      (b) => !playlist.background_playlist_items.some((i) => i.background_item_id === b.id),
    )

  return (
    <section className="sr-card">
      <h2 className="sr-section-title">幻燈片</h2>

      {playlists.length === 0 && (
        <p className="sr-muted">
          建立一個播放清單，把背景加進去，就能自動輪播。
        </p>
      )}

      <div className="sr-row" style={{ marginBottom: 'var(--sr-space-6)' }}>
        <input
          className="sr-input"
          value={newName}
          maxLength={80}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="新播放清單的名稱"
          style={{ maxWidth: 240 }}
        />
        <button
          type="button"
          className="sr-button"
          onClick={() => void create()}
          disabled={creating || newName.trim().length === 0}
        >
          建立播放清單
        </button>
      </div>

      {playlists.map((playlist) => {
        const items = [...playlist.background_playlist_items].sort(
          (a, b) => a.position - b.position,
        )
        const available = unusedFor(playlist)

        return (
          <article key={playlist.id} className="sr-playlist">
            <header className="sr-row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {playlist.name}
                {playlist.is_active && <span className="sr-badge">播放中</span>}
              </strong>
              <button
                type="button"
                className="sr-button sr-button-secondary"
                onClick={() => void activate(playlist.id)}
                disabled={playlist.is_active || items.length === 0}
                title={items.length === 0 ? '要先加入至少一個背景' : undefined}
              >
                {playlist.is_active ? '使用中' : '啟用'}
              </button>
            </header>

            <div className="sr-row" style={{ marginTop: 'var(--sr-space-3)' }}>
              <label className="sr-label" htmlFor={`mode-${playlist.id}`}>
                播放方式
              </label>
              <select
                id={`mode-${playlist.id}`}
                className="sr-input"
                value={playlist.play_mode}
                onChange={(e) => void patch(playlist.id, { playMode: e.target.value })}
                style={{ maxWidth: 200 }}
              >
                {PLAY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <label className="sr-label" htmlFor={`transition-${playlist.id}`}>
                轉場
              </label>
              <select
                id={`transition-${playlist.id}`}
                className="sr-input"
                value={playlist.transition}
                onChange={(e) => void patch(playlist.id, { transition: e.target.value })}
                style={{ maxWidth: 180 }}
              >
                {transitions.map((t) => (
                  <option key={t} value={t}>
                    {TRANSITION_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <p className="sr-muted">
              {PLAY_MODES.find((m) => m.value === playlist.play_mode)?.description}
            </p>

            {playlist.play_mode === 'sequential' && (
              <div className="sr-field">
                <label className="sr-label" htmlFor={`interval-${playlist.id}`}>
                  每張停留 {Math.round(playlist.interval_seconds / 60)} 分鐘
                </label>
                <input
                  type="range"
                  id={`interval-${playlist.id}`}
                  min={60}
                  max={3600}
                  step={60}
                  value={playlist.interval_seconds}
                  onChange={(e) =>
                    void patch(playlist.id, { intervalSeconds: Number(e.target.value) })
                  }
                />
              </div>
            )}

            {playlist.play_mode === 'time_of_day' && (
              <div className="sr-field">
                <ScheduleEditor
                  slots={(playlist.schedule?.slots ?? []) as Slot[]}
                  backgrounds={backgrounds.map((bg) => ({
                    id: bg.id,
                    label: bg.name ?? '未命名背景',
                  }))}
                  onChange={(slots) => void patch(playlist.id, { schedule: { slots } }, false)}
                />
              </div>
            )}

            {items.length === 0 ? (
              <p className="sr-muted">這個清單還是空的。</p>
            ) : (
              <ol className="sr-playlist-items">
                {items.map((item, index) => (
                  <li key={item.id} className="sr-playlist-item">
                    <span className="sr-muted">{index + 1}</span>
                    <span>{labelFor(backgrounds, item.background_item_id)}</span>
                    <span className="sr-row">
                      <button
                        type="button"
                        className="sr-asset-delete"
                        onClick={() => void move(playlist, item.id, -1)}
                        disabled={index === 0}
                        aria-label={`把第 ${index + 1} 項往前移`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="sr-asset-delete"
                        onClick={() => void move(playlist, item.id, 1)}
                        disabled={index === items.length - 1}
                        aria-label={`把第 ${index + 1} 項往後移`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="sr-asset-delete"
                        onClick={() => void removeItem(playlist.id, item.id)}
                        aria-label={`從清單移除第 ${index + 1} 項`}
                      >
                        移除
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {available.length > 0 && (
              <div className="sr-row">
                <label className="sr-label" htmlFor={`add-${playlist.id}`}>
                  加入背景
                </label>
                <select
                  id={`add-${playlist.id}`}
                  className="sr-input"
                  defaultValue=""
                  style={{ maxWidth: 240 }}
                  onChange={(e) => {
                    if (e.target.value) {
                      void addItems(playlist.id, [e.target.value])
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="">選擇…</option>
                  {available.map((b) => (
                    <option key={b.id} value={b.id}>
                      {backgroundLabel(b)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}

function labelFor(backgrounds: BackgroundItem[], id: string): string {
  const bg = backgrounds.find((b) => b.id === id)
  if (!bg) return '（已移除的背景）'
  return backgroundLabel(bg)
}

/** 有名稱就用名稱 —— 否則多個圖片背景在清單裡完全無法分辨。 */
export function backgroundLabel(bg: BackgroundItem): string {
  if (bg.name) return bg.name
  return bg.type === 'gradient' ? '漸層背景' : '圖片背景'
}
