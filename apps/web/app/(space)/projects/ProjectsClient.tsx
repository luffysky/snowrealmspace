'use client'

import { useCallback, useEffect, useState } from 'react'
import { PROJECT_STATUSES, type ProjectStatus } from '@snowrealm/validation'

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  cover_asset_id: string | null
  tags: string[]
  last_activity_at: string
  created_at: string
  updated_at: string
}

export type AssetOption = { id: string; label: string }

const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: '構想',
  active: '進行中',
  paused: '暫停',
  completed: '完成',
  archived: '封存',
}

type FormState = {
  id: string | null // null = 新增，否則編輯
  name: string
  description: string
  status: ProjectStatus
  coverAssetId: string
  tags: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  status: 'idea',
  coverAssetId: '',
  tags: '',
}

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        // 逗號或空白分隔；一併吃全形逗號與全形空格（用 unicode escape 保持純 ASCII）
        .split(/[\s,\uFF0C\u3000]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20)
}

export function ProjectsClient({
  spaceId,
  initialProjects,
  assetOptions,
}: {
  spaceId: string
  initialProjects: ProjectRow[]
  assetOptions: AssetOption[]
}) {
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects)
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const headers = { 'x-space-id': spaceId, 'content-type': 'application/json' }

  const visible = filter === 'all' ? projects : projects.filter((p) => p.status === filter)
  const isEditing = form.id !== null

  function resetForm() {
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('請輸入專案名稱。')
      return
    }
    setBusy(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      coverAssetId: form.coverAssetId || null,
      tags: parseTags(form.tags),
    }

    try {
      const res = form.id
        ? await fetch(`/api/projects/${form.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          })
        : await fetch('/api/projects', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })

      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。'
        setError(`✕ ${msg}`)
        return
      }
      const saved = (body as { data: ProjectRow }).data
      setProjects((prev) =>
        form.id ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev],
      )
      setNotice(form.id ? '已更新。' : '已建立專案。')
      resetForm()
    } catch {
      setError('✕ 網路錯誤，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: ProjectRow) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      status: p.status,
      coverAssetId: p.cover_asset_id ?? '',
      tags: p.tags.join(', '),
    })
    setError(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(p: ProjectRow) {
    if (!window.confirm(`刪除專案「${p.name}」？裡面的作品會保留，只解除歸屬。`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE', headers })
      if (!res.ok) {
        setError('✕ 刪除失敗。')
        return
      }
      setProjects((prev) => prev.filter((x) => x.id !== p.id))
      if (form.id === p.id) resetForm()
      setNotice('已刪除專案。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      {/* ── 建立 / 編輯表單 ───────────────────────────── */}
      <form className="sr-card sr-stack" onSubmit={handleSubmit} aria-label={isEditing ? '編輯專案' : '建立專案'}>
        <h2 style={{ fontSize: 'var(--sr-text-lg)' }}>{isEditing ? '編輯專案' : '新增專案'}</h2>

        <label className="sr-field">
          <span>名稱</span>
          <input
            className="sr-input"
            value={form.name}
            maxLength={80}
            required
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="例：六月海報"
          />
        </label>

        <label className="sr-field">
          <span>描述（可留空）</span>
          <textarea
            className="sr-input"
            value={form.description}
            maxLength={2000}
            rows={2}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>

        <div className="sr-form-cols">
          <label className="sr-field">
            <span>狀態</span>
            <select
              className="sr-input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="sr-field">
            <span>封面圖（可留空）</span>
            <select
              className="sr-input"
              value={form.coverAssetId}
              onChange={(e) => setForm((f) => ({ ...f, coverAssetId: e.target.value }))}
            >
              <option value="">— 無 —</option>
              {assetOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="sr-field">
          <span>標籤（逗號或空格分隔）</span>
          <input
            className="sr-input"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="海報, 插畫"
          />
        </label>

        {error && (
          <p className="sr-message sr-message-error" role="alert">
            {error}
          </p>
        )}

        <div className="sr-btn-row">
          <button className="sr-button" type="submit" disabled={busy}>
            {busy ? '處理中…' : isEditing ? '儲存變更' : '建立專案'}
          </button>
          {isEditing && (
            <button className="sr-button sr-button-secondary" type="button" onClick={resetForm} disabled={busy}>
              取消
            </button>
          )}
        </div>
      </form>

      {/* ── 狀態篩選 ─────────────────────────────────── */}
      <div className="sr-chip-row" role="group" aria-label="依狀態篩選">
        <button
          type="button"
          className={`sr-chip${filter === 'all' ? ' sr-chip-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部（{projects.length}）
        </button>
        {PROJECT_STATUSES.map((s) => {
          const n = projects.filter((p) => p.status === s).length
          return (
            <button
              key={s}
              type="button"
              className={`sr-chip${filter === s ? ' sr-chip-active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {STATUS_LABEL[s]}（{n}）
            </button>
          )
        })}
      </div>

      {/* ── 專案清單 / 空狀態 ─────────────────────────── */}
      {visible.length === 0 ? (
        <p className="sr-muted" style={{ padding: 'var(--sr-space-4) 0' }}>
          {projects.length === 0
            ? '還沒有任何專案。用上面的表單建立第一個。'
            : '這個狀態底下還沒有專案。'}
        </p>
      ) : (
        <ul className="sr-project-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visible.map((p) => (
            <li key={p.id} className="sr-card sr-project-card">
              <Cover spaceId={spaceId} assetId={p.cover_asset_id} />
              <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--sr-space-2)',
                  }}
                >
                  <strong>{p.name}</strong>
                  <span className={`sr-badge sr-badge-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                {p.description && <p className="sr-muted">{p.description}</p>}
                {p.tags.length > 0 && (
                  <div className="sr-chip-row">
                    {p.tags.map((t) => (
                      <span key={t} className="sr-chip sr-chip-tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="sr-btn-row">
                  <button className="sr-button sr-button-secondary" type="button" onClick={() => startEdit(p)}>
                    編輯
                  </button>
                  <button
                    className="sr-button sr-button-danger"
                    type="button"
                    onClick={() => void handleDelete(p)}
                    disabled={busy}
                  >
                    刪除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 封面縮圖：跟 AssetGrid 一樣走 signed URL；沒有封面時顯示佔位。 */
function Cover({ spaceId, assetId }: { spaceId: string; assetId: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!assetId) return
    try {
      const res = await fetch(`/api/assets/${assetId}/url?rendition=thumbnail`, {
        headers: { 'x-space-id': spaceId },
      })
      if (!res.ok) {
        setFailed(true)
        return
      }
      const body = (await res.json()) as { data: { url: string } }
      setUrl(body.data.url)
    } catch {
      setFailed(true)
    }
  }, [assetId, spaceId])

  useEffect(() => {
    void load()
  }, [load])

  if (!assetId || failed) {
    return <div className="sr-project-cover sr-project-cover-empty" aria-hidden="true" />
  }
  return (
    <div className="sr-project-cover">
      {url && <img src={url} alt="" loading="lazy" />}
    </div>
  )
}
