'use client'

import { useCallback, useEffect, useState } from 'react'
import { ALPHA_TRANSITIONS } from '@snowrealm/validation'
import { NEUTRAL } from '@snowrealm/theme-engine'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import { BackgroundEditor } from './BackgroundEditor'
import { PlaylistPanel, backgroundLabel, type Playlist } from './PlaylistPanel'

export type AssetOption = {
  id: string
  kind: string
  original_filename: string | null
}

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

export function BackgroundStudio({
  spaceId,
  initialBackgrounds,
  initialPlaylists,
  imageAssets,
}: {
  spaceId: string
  initialBackgrounds: BackgroundItem[]
  initialPlaylists: Playlist[]
  imageAssets: AssetOption[]
}) {
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds)
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [editing, setEditing] = useState<BackgroundItem | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

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

  async function addFromAsset(assetId: string) {
    try {
      // 型別依 asset 的 kind 而定：影片檔要建成 video 背景（否則後端會擋「這個檔案不是圖片」）
      const asset = imageAssets.find((a) => a.id === assetId)
      const type = asset?.kind === 'video' ? 'video' : 'image'
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ type, assetId, fit: 'cover' }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: type === 'video' ? '已加入影片背景。' : '已加入背景。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addGradient() {
    try {
      // 預設漸層取自目前套用的主題，而不是寫死一組顏色 ——
      // 新增的背景一開始就與使用者的空間協調。
      const [from, to] = readThemeGradientSeed()

      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({
          type: 'gradient',
          name: '漸層',
          gradientSpec: {
            kind: 'linear',
            angle: 160,
            stops: [
              { color: from, position: 0 },
              { color: to, position: 100 },
            ],
          },
        }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: '已加入漸層背景。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addSolid() {
    try {
      // 單色 = 兩個相同色停的漸層（渲染即為純色），不必新增資料型別。
      const [from] = readThemeGradientSeed()
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({
          type: 'gradient',
          name: '單色',
          gradientSpec: {
            kind: 'linear',
            angle: 0,
            stops: [
              { color: from, position: 0 },
              { color: from, position: 100 },
            ],
          },
        }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: '已加入單色背景。到調整面板可換顏色。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function updateBackground(id: string, patch: Record<string, unknown>) {
    try {
      const updated = (await api(`/api/backgrounds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })) as BackgroundItem
      setBackgrounds((prev) => prev.map((b) => (b.id === id ? updated : b)))
      setEditing((prev) => (prev?.id === id ? updated : prev))
    } catch (err) {
      // 靜默失敗是 bug：調整沒存到卻讓預覽照舊顯示，重載就消失。
      // 明確告知，並把畫面拉回伺服器的真實值（丟棄這次沒存成功的編輯）。
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '調整沒有存到。' })
      const server = backgrounds.find((b) => b.id === id)
      if (server) setEditing((prev) => (prev?.id === id ? server : prev))
    }
  }

  async function removeBackground(id: string) {
    try {
      await api(`/api/backgrounds/${id}`, { method: 'DELETE' })
      setBackgrounds((prev) => prev.filter((b) => b.id !== id))
      setEditing((prev) => (prev?.id === id ? null : prev))
      setStatus({ kind: 'ok', message: '已移除。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '移除失敗。' })
    }
  }

  return (
    <div className="sr-stack">
      {status.kind === 'error' && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {status.message}
        </p>
      )}
      {status.kind === 'ok' && (
        <p className="sr-message sr-message-success" role="status">
          ✓ {status.message}
        </p>
      )}

      <section className="sr-card" data-tour="bg-add">
        <h2 className="sr-section-title">加入背景</h2>

        {imageAssets.length === 0 ? (
          <p className="sr-muted">
            還沒有可用的圖片或影片。先到 Library 上傳一個，再回來這裡。
          </p>
        ) : (
          <>
            <label className="sr-label" htmlFor="asset-picker">
              從你的圖片或影片選一個
            </label>
            <div className="sr-row">
              <select
                id="asset-picker"
                className="sr-input"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    void addFromAsset(e.target.value)
                    e.target.value = ''
                  }
                }}
              >
                <option value="">選擇圖片或影片…</option>
                {imageAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kind === 'video' ? '🎬 ' : ''}
                    {a.original_filename ?? '未命名'}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="sr-btn-row" style={{ marginTop: 'var(--sr-space-4)' }}>
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => void addSolid()}
          >
            加入單色背景
          </button>
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => void addGradient()}
          >
            加入漸層背景
          </button>
        </div>
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">你的背景（{backgrounds.length}）</h2>

        {backgrounds.length === 0 ? (
          <p className="sr-muted">還沒有背景。</p>
        ) : (
          <ul className="sr-bg-grid">
            {backgrounds.map((bg) => (
              <li key={bg.id} className="sr-bg-card">
                <button
                  type="button"
                  className="sr-bg-select"
                  onClick={() => setEditing(bg)}
                  aria-pressed={editing?.id === bg.id}
                  aria-label={`編輯 ${backgroundLabel(bg)}`}
                >
                  <BackgroundThumb spaceId={spaceId} item={bg} />
                  <span className="sr-muted">{backgroundLabel(bg)}</span>
                </button>
                <button
                  type="button"
                  className="sr-asset-delete"
                  onClick={() => void removeBackground(bg.id)}
                  aria-label={`移除 ${backgroundLabel(bg)}`}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <BackgroundEditor
          spaceId={spaceId}
          item={editing}
          onChange={(patch) => void updateBackground(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}

      <PlaylistPanel
        spaceId={spaceId}
        playlists={playlists}
        backgrounds={backgrounds}
        transitions={ALPHA_TRANSITIONS}
        onChange={setPlaylists}
        onStatus={(message, isError) =>
          setStatus(isError ? { kind: 'error', message } : { kind: 'ok', message })
        }
      />
    </div>
  )
}

function BackgroundThumb({ spaceId, item }: { spaceId: string; item: BackgroundItem }) {
  const [url, setUrl] = useState<string | null>(null)

  // 用 useEffect（不是 useState 初始化器）才不會在 render 期間發副作用、
  // StrictMode 下不會雙跑；asset 換了會重抓，卸載會取消。
  useEffect(() => {
    if (!item.asset_id) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/assets/${item.asset_id}/url?rendition=thumbnail`, {
      headers: { 'x-space-id': spaceId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: { url: string } } | null) => {
        if (!cancelled) setUrl(b?.data?.url ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, item.asset_id])

  if (item.type === 'gradient' && item.gradient_spec) {
    const stops = item.gradient_spec.stops
      .map((s) => `${s.color} ${s.position}%`)
      .join(', ')
    return (
      <span
        className="sr-bg-thumb"
        aria-hidden="true"
        style={{ background: `linear-gradient(${item.gradient_spec.angle}deg, ${stops})` }}
      />
    )
  }

  return (
    <span className="sr-bg-thumb" aria-hidden="true">
      {url && <img src={url} alt="" />}
    </span>
  )
}

/**
 * 從目前套用的主題讀出兩個顏色當漸層起訖。
 * API 只接受 #RRGGBB，所以讀不到合法值時退回中性灰白 ——
 * 那是 NEUTRAL 的用途（唯一允許字面色值的地方）。
 */
function readThemeGradientSeed(): [string, string] {
  const style = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim()
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  }
  return [
    pick('--sr-secondary', NEUTRAL.white),
    pick('--sr-accent', NEUTRAL.nearBlack),
  ]
}
