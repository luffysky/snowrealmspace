'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FeatureComparison } from '@snowrealm/theme-engine'

export type Snapshot = { id: string; asset_id: string; created_at: string }
export type WorkFile = {
  id: string
  title: string
  description: string | null
  project_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
  snapshots: Snapshot[]
}
export type AssetOption = { id: string; label: string }

type CompareMode = 'side' | 'overlay' | 'slider'

/** 短期 signed URL 快取，避免同一張圖重覆請求。 */
function useSignedUrl(spaceId: string, assetId: string | null, rendition: string) {
  const [url, setUrl] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!assetId) return
    const res = await fetch(`/api/assets/${assetId}/url?rendition=${rendition}`, {
      headers: { 'x-space-id': spaceId },
    })
    if (!res.ok) return
    const body = (await res.json()) as { data: { url: string } }
    setUrl(body.data.url)
  }, [spaceId, assetId, rendition])
  useEffect(() => {
    setUrl(null)
    void load()
  }, [load])
  return url
}

function Thumb({ spaceId, assetId }: { spaceId: string; assetId: string | null }) {
  const url = useSignedUrl(spaceId, assetId, 'thumbnail')
  if (!url) return <span className="sr-asset-placeholder" aria-hidden="true">…</span>
  return <img src={url} alt="" loading="lazy" />
}

export function WorksClient({
  spaceId,
  initialFiles,
  assetOptions,
}: {
  spaceId: string
  initialFiles: WorkFile[]
  assetOptions: AssetOption[]
}) {
  const [files, setFiles] = useState<WorkFile[]>(initialFiles)
  const [selectedId, setSelectedId] = useState<string | null>(initialFiles[0]?.id ?? null)
  const [notice, setNotice] = useState<string | null>(null)

  const selected = files.find((f) => f.id === selectedId) ?? null
  const headers = { 'x-space-id': spaceId, 'content-type': 'application/json' }

  async function reload() {
    const res = await fetch('/api/design/files', { headers: { 'x-space-id': spaceId } })
    if (!res.ok) return
    const body = (await res.json()) as { data: WorkFile[] }
    setFiles(body.data)
  }

  async function addVersion(file: WorkFile) {
    const first = assetOptions[0]
    if (!first) {
      setNotice('✕ 還沒有可用的圖片，先去 Library 上傳。')
      return
    }
    const id = window.prompt(
      `輸入要當新版本的圖片 asset id\n（可到 Library 複製；例如最新：${first.id}）`,
      first.id,
    )
    if (!id) return
    const res = await fetch(`/api/design/files/${file.id}/snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ assetId: id.trim() }),
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? '失敗。'
      setNotice(`✕ ${msg}`)
      return
    }
    setNotice('已新增版本。')
    await reload()
  }

  async function deleteFile(file: WorkFile) {
    if (!window.confirm(`刪除作品「${file.title}」？版本會一併隱藏，原始檔案保留。`)) return
    const res = await fetch(`/api/design/files/${file.id}`, {
      method: 'DELETE',
      headers: { 'x-space-id': spaceId },
    })
    if (!res.ok) {
      setNotice('✕ 刪除失敗。')
      return
    }
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
    if (selectedId === file.id) setSelectedId(null)
    setNotice('已刪除作品。')
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      {files.length === 0 ? (
        <p className="sr-muted" style={{ padding: 'var(--sr-space-4) 0' }}>
          還沒有作品。到 Library 對一張圖按「設為作品」，它就會出現在這裡。
        </p>
      ) : (
        <div className="sr-works-layout">
          {/* 作品清單 */}
          <ul className="sr-works-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={`sr-works-item${f.id === selectedId ? ' sr-works-item-active' : ''}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <Thumb spaceId={spaceId} assetId={f.snapshots[0]?.asset_id ?? null} />
                  <span>
                    <strong>{f.title}</strong>
                    <span className="sr-muted"> · {f.snapshots.length} 版</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* 選中的作品：版本 + 比較 */}
          {selected && (
            <WorkDetail
              key={selected.id}
              spaceId={spaceId}
              file={selected}
              onAddVersion={() => void addVersion(selected)}
              onDelete={() => void deleteFile(selected)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function WorkDetail({
  spaceId,
  file,
  onAddVersion,
  onDelete,
}: {
  spaceId: string
  file: WorkFile
  onAddVersion: () => void
  onDelete: () => void
}) {
  const snaps = [...file.snapshots].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const [a, setA] = useState<string | null>(snaps[0]?.id ?? null)
  const [b, setB] = useState<string | null>(snaps[snaps.length - 1]?.id ?? null)
  const [mode, setMode] = useState<CompareMode>('side')
  const [pos, setPos] = useState(50)
  const [comparison, setComparison] = useState<FeatureComparison | null>(null)

  const snapA = snaps.find((s) => s.id === a) ?? null
  const snapB = snaps.find((s) => s.id === b) ?? null
  const canCompare = snapA && snapB && a !== b

  const urlA = useSignedUrl(spaceId, snapA?.asset_id ?? null, 'preview')
  const urlB = useSignedUrl(spaceId, snapB?.asset_id ?? null, 'preview')

  useEffect(() => {
    setComparison(null)
    if (!canCompare) return
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/design/snapshots/compare', {
        method: 'POST',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ a, b }),
      })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as { data: { comparison: FeatureComparison } }
      if (!cancelled) setComparison(body.data.comparison)
    })()
    return () => {
      cancelled = true
    }
  }, [a, b, canCompare, spaceId])

  return (
    <section className="sr-card sr-stack sr-work-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sr-space-2)' }}>
        <h2 style={{ fontSize: 'var(--sr-text-lg)' }}>{file.title}</h2>
        <div className="sr-btn-row">
          <button className="sr-button sr-button-secondary" type="button" onClick={onAddVersion}>
            新增版本
          </button>
          <button className="sr-button sr-button-danger" type="button" onClick={onDelete}>
            刪除作品
          </button>
        </div>
      </div>

      {snaps.length < 2 ? (
        <p className="sr-muted">
          只有一個版本。用同一件作品「新增版本」（換一張圖），就能開始比較。
        </p>
      ) : (
        <>
          {/* 版本選擇 */}
          <div className="sr-form-cols">
            <label className="sr-field">
              <span>版本 A</span>
              <select className="sr-input" value={a ?? ''} onChange={(e) => setA(e.target.value)}>
                {snaps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    v{i + 1} · {new Date(s.created_at).toLocaleDateString('zh-TW')}
                  </option>
                ))}
              </select>
            </label>
            <label className="sr-field">
              <span>版本 B</span>
              <select className="sr-input" value={b ?? ''} onChange={(e) => setB(e.target.value)}>
                {snaps.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    v{i + 1} · {new Date(s.created_at).toLocaleDateString('zh-TW')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 比較模式切換 */}
          <div className="sr-chip-row" role="group" aria-label="比較模式">
            {(['side', 'overlay', 'slider'] as CompareMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`sr-chip${mode === m ? ' sr-chip-active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'side' ? '並排' : m === 'overlay' ? '疊圖' : '滑桿'}
              </button>
            ))}
          </div>

          {/* 比較視圖 */}
          {mode === 'side' && (
            <div className="sr-compare-side">
              <figure>{urlA && <img src={urlA} alt="版本 A" />}</figure>
              <figure>{urlB && <img src={urlB} alt="版本 B" />}</figure>
            </div>
          )}

          {mode === 'overlay' && (
            <div className="sr-compare-stack">
              {urlA && <img src={urlA} alt="版本 A" />}
              {urlB && <img src={urlB} alt="版本 B" style={{ opacity: pos / 100 }} />}
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                aria-label="上層版本透明度"
              />
            </div>
          )}

          {mode === 'slider' && (
            <div className="sr-compare-stack">
              {urlA && <img src={urlA} alt="版本 A" />}
              {urlB && (
                <img
                  src={urlB}
                  alt="版本 B"
                  style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
                />
              )}
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                aria-label="比較分隔位置"
              />
            </div>
          )}

          {/* 數值差異 */}
          {comparison && <DiffPanel c={comparison} />}
        </>
      )}
    </section>
  )
}

function Swatch({ hex }: { hex: string | null }) {
  if (!hex) return <span className="sr-muted">—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="sr-palette-chip" style={{ width: 16, height: 16, background: hex }} />
      {hex}
    </span>
  )
}

function DiffPanel({ c }: { c: FeatureComparison }) {
  const pct = (n: number | null) => (n === null ? '—' : `${n}`)
  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
      <h3 className="sr-section-title">數值差異</h3>
      <div className="sr-diff-grid">
        <div>
          <strong>尺寸</strong>
          <p className="sr-muted">
            寬 {pct(c.dimensions.widthDelta)} · 高 {pct(c.dimensions.heightDelta)} · 長寬比{' '}
            {pct(c.dimensions.aspectRatioDelta)}
          </p>
        </div>
        <div>
          <strong>主色差異</strong>
          <p className="sr-muted">
            距離 {pct(c.colors.dominant.distance)}／100 —— <Swatch hex={c.colors.dominant.from} /> →{' '}
            <Swatch hex={c.colors.dominant.to} />
          </p>
        </div>
        <div>
          <strong>強調色差異</strong>
          <p className="sr-muted">
            距離 {pct(c.colors.accent.distance)}／100 —— <Swatch hex={c.colors.accent.from} /> →{' '}
            <Swatch hex={c.colors.accent.to} />
          </p>
        </div>
        <div>
          <strong>統計</strong>
          <p className="sr-muted">
            留白 {pct(c.stats.whitespaceDelta)} · 飽和 {pct(c.stats.saturationDelta)} · 明度{' '}
            {pct(c.stats.lightnessDelta)}
            {c.stats.isDarkChanged ? ' · 明暗傾向改變' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
