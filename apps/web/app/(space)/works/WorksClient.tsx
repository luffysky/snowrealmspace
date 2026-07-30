'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FeatureComparison } from '@snowrealm/theme-engine'
import { useDialog } from '@/components/ui/DialogProvider'
import { AssetPicker } from '@/components/ui/AssetPicker'
import { ShareLinksPanel } from './ShareLinksPanel'

export type Snapshot = { id: string; asset_id: string; created_at: string }
export type WorkFile = {
  id: string
  title: string
  description: string | null
  project_id: string | null
  tags: string[]
  visibility: 'private' | 'unlisted' | 'public'
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
  memoryEnabled,
  initialSelectedId,
}: {
  spaceId: string
  initialFiles: WorkFile[]
  assetOptions: AssetOption[]
  memoryEnabled: boolean
  /** 由 `/works?work=<id>` 帶入的預選作品（例如從「最近作品」widget 點進來）。 */
  initialSelectedId?: string | null
}) {
  const [files, setFiles] = useState<WorkFile[]>(initialFiles)
  // 預選：query 帶的 id 若在清單內就用它，否則退回第一個。
  const [selectedId, setSelectedId] = useState<string | null>(
    (initialSelectedId && initialFiles.some((f) => f.id === initialSelectedId) ? initialSelectedId : null) ??
      initialFiles[0]?.id ??
      null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<WorkFile | null>(null)
  const { confirm } = useDialog()

  const selected = files.find((f) => f.id === selectedId) ?? null
  const headers = { 'x-space-id': spaceId, 'content-type': 'application/json' }

  async function reload() {
    const res = await fetch('/api/design/files', { headers: { 'x-space-id': spaceId } })
    if (!res.ok) return
    const body = (await res.json()) as { data: WorkFile[] }
    setFiles(body.data)
  }

  function addVersion(file: WorkFile) {
    if (assetOptions.length === 0) {
      setNotice('✕ 還沒有可用的圖片，先去 Library 上傳。')
      return
    }
    setPickerFor(file)
  }

  async function pickVersionAsset(assetId: string) {
    const file = pickerFor
    setPickerFor(null)
    if (!file) return
    const res = await fetch(`/api/design/files/${file.id}/snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ assetId }),
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
    if (!(await confirm({ title: '刪除作品', message: `刪除作品「${file.title}」？版本會一併隱藏，原始檔案保留。`, danger: true, confirmText: '刪除' }))) return
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
      <AssetPicker
        open={pickerFor !== null}
        assets={assetOptions}
        title="選一張圖片當新版本"
        onPick={(id) => void pickVersionAsset(id)}
        onClose={() => setPickerFor(null)}
      />
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
              memoryEnabled={memoryEnabled}
              onAddVersion={() => void addVersion(selected)}
              onDelete={() => void deleteFile(selected)}
              onUpdated={() => void reload()}
            />
          )}
        </div>
      )}
    </div>
  )
}

type Insight = {
  id: string
  createdAt: string
  kind: string
  model: string | null
  summary: string
  projectName: string | null
  provider: string
  versionLabel: string | null
}

/** provider → 中文來源軟體。未知值退回「其他」，不硬編色。 */
function providerLabel(p: string): string {
  switch (p) {
    case 'figma':
      return 'Figma'
    case 'canva':
      return 'Canva'
    case 'adobe':
      return 'Adobe'
    case 'upload':
      return '上傳'
    default:
      return '其他'
  }
}

function WorkDetail({
  spaceId,
  file,
  memoryEnabled,
  onAddVersion,
  onDelete,
  onUpdated,
}: {
  spaceId: string
  file: WorkFile
  memoryEnabled: boolean
  onAddVersion: () => void
  onDelete: () => void
  onUpdated: () => void
}) {
  const snaps = [...file.snapshots].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const [a, setA] = useState<string | null>(snaps[0]?.id ?? null)
  const [b, setB] = useState<string | null>(snaps[snaps.length - 1]?.id ?? null)
  const [mode, setMode] = useState<CompareMode>('side')
  const [pos, setPos] = useState(50)
  const [comparison, setComparison] = useState<FeatureComparison | null>(null)
  const [visibility, setVisibility] = useState(file.visibility)
  const [visSaving, setVisSaving] = useState(false)
  const [visErr, setVisErr] = useState<string | null>(null)
  // 作品資料編輯（標題/描述/標籤）—— 建立後一直沒有入口可改
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(file.title)
  const [editDesc, setEditDesc] = useState(file.description ?? '')
  const [editTags, setEditTags] = useState((file.tags ?? []).join(', '))
  const [editSaving, setEditSaving] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)

  async function saveEdit() {
    const title = editTitle.trim()
    if (!title) {
      setEditErr('標題不能空白。')
      return
    }
    setEditSaving(true)
    setEditErr(null)
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await fetch(`/api/design/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ title, description: editDesc.trim() || null, tags }),
      })
      if (!res.ok) throw new Error()
      setEditing(false)
      onUpdated()
    } catch {
      setEditErr('存不了，請再試一次。')
    } finally {
      setEditSaving(false)
    }
  }
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])

  const loadInsights = useCallback(async () => {
    const res = await fetch(`/api/design/insights?fileId=${file.id}`, {
      headers: { 'x-space-id': spaceId },
    })
    if (!res.ok) return
    const body = (await res.json()) as { data: Insight[] }
    setInsights(body.data)
  }, [spaceId, file.id])

  useEffect(() => {
    void loadInsights()
  }, [loadInsights])

  async function analyzeDesign(deep: boolean) {
    if (!a) return // a = 目前選的版本 A 的 snapshot id
    setAiBusy(true)
    setAiErr(null)
    setAiAnalysis(null)
    try {
      const res = await fetch('/api/design/vision', {
        method: 'POST',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ snapshotId: a, deep }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setAiErr((body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 分析失敗。')
        return
      }
      setAiAnalysis((body as { data: { analysis: string } }).data.analysis)
      void loadInsights() // 分析已存成歷史 → 重載清單
    } catch {
      setAiErr('網路錯誤，請重試。')
    } finally {
      setAiBusy(false)
    }
  }

  async function changeVisibility(next: 'private' | 'unlisted' | 'public') {
    const prev = visibility
    setVisibility(next)
    setVisSaving(true)
    setVisErr(null)
    try {
      const res = await fetch(`/api/design/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setVisibility(prev)
      setVisErr('改不了可見性，請重試。')
    } finally {
      setVisSaving(false)
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--sr-text-lg)', minWidth: 0, overflowWrap: 'anywhere' }}>{file.title}</h2>
        <div className="sr-btn-row">
          <button className="sr-button sr-button-secondary" type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? '取消編輯' : '編輯資料'}
          </button>
          <button className="sr-button sr-button-secondary" type="button" onClick={onAddVersion}>
            新增版本
          </button>
          <button className="sr-button sr-button-danger" type="button" onClick={onDelete}>
            刪除作品
          </button>
        </div>
      </div>

      {editing && (
        <div className="sr-card sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
          <label className="sr-field" style={{ margin: 0 }}>
            <span>標題</span>
            <input className="sr-input" value={editTitle} maxLength={120} onChange={(e) => setEditTitle(e.target.value)} />
          </label>
          <label className="sr-field" style={{ margin: 0 }}>
            <span>描述</span>
            <textarea className="sr-input" rows={2} value={editDesc} maxLength={2000} onChange={(e) => setEditDesc(e.target.value)} placeholder="這個作品是關於…" />
          </label>
          <label className="sr-field" style={{ margin: 0 }}>
            <span>標籤（用逗號分隔）</span>
            <input className="sr-input" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="海報, 插畫, 品牌" />
          </label>
          {editErr && <p className="sr-message sr-message-error" style={{ margin: 0 }}>{editErr}</p>}
          <div className="sr-btn-row">
            <button className="sr-button" type="button" onClick={() => void saveEdit()} disabled={editSaving || !editTitle.trim()}>
              {editSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}

      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="sr-field" style={{ margin: 0 }}>
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>可見性</span>
          <select
            className="sr-input"
            value={visibility}
            disabled={visSaving}
            onChange={(e) => void changeVisibility(e.target.value as 'private' | 'unlisted' | 'public')}
          >
            <option value="private">🔒 私人（只有你）</option>
            <option value="unlisted">🔗 有連結才看</option>
            <option value="public">🌐 公開（列在作品集）</option>
          </select>
        </label>
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
          {visibility === 'public'
            ? '會出現在你的公開作品集頁。'
            : visibility === 'unlisted'
              ? '不會被列出，但知道連結的人看得到。'
              : '只有空間成員看得到。'}
        </span>
        {visibility !== 'private' && (
          <button
            type="button"
            className="sr-button sr-button-secondary"
            style={{ padding: '2px 10px' }}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`${window.location.origin}/w/${file.id}`)
                .then(() => setVisErr('已複製連結。'))
                .catch(() => setVisErr('複製失敗，請手動複製網址。'))
            }}
          >
            複製連結
          </button>
        )}
        {visErr && (
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
            {visErr}
          </span>
        )}
      </div>

      <ShareLinksPanel spaceId={spaceId} fileId={file.id} />

      <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>AI 看法</strong>
          <div className="sr-row" style={{ gap: '4px' }}>
            <button
              type="button"
              className="sr-button sr-button-secondary"
              disabled={aiBusy || !a}
              onClick={() => void analyzeDesign(false)}
            >
              {aiBusy ? '看圖中…' : '快速分析'}
            </button>
            <button
              type="button"
              className="sr-button sr-button-secondary"
              disabled={aiBusy || !a}
              onClick={() => void analyzeDesign(true)}
              title="用更強的模型深入看（可能較慢）"
            >
              深入分析
            </button>
          </div>
        </div>
        {aiErr && (
          <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
            {aiErr}
          </p>
        )}
        {aiAnalysis && (
          <div className="sr-card" style={{ background: 'var(--sr-surface-alt)' }}>
            {aiAnalysis.split('\n').map((line, i) =>
              line.trim() ? (
                <p key={i} style={{ margin: '0 0 var(--sr-space-2)', overflowWrap: 'anywhere' }}>
                  {line}
                </p>
              ) : null,
            )}
          </div>
        )}
      </div>

      <AnalysisHistory insights={insights} />

      <WorkChat
        spaceId={spaceId}
        fileId={file.id}
        seedSnapshot={snaps[snaps.length - 1] ?? null}
        memoryEnabled={memoryEnabled}
      />

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

/** 分析歷史：design_insights 清單。每列時間 · 來源軟體 · 專案 · 版本 · 模型，分析全文可展開。 */
function AnalysisHistory({ insights }: { insights: Insight[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)', minWidth: 0 }}>
      <strong>分析歷史</strong>
      {insights.length === 0 ? (
        <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
          還沒有分析紀錄。按上面的「快速分析」或「深入分析」，結果會存在這裡。
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="sr-stack">
          {insights.map((it) => {
            const open = openId === it.id
            return (
              <li key={it.id} className="sr-card" style={{ background: 'var(--sr-surface-alt)', minWidth: 0 }}>
                <button
                  type="button"
                  className="sr-linkish"
                  style={{ textAlign: 'left', width: '100%', minWidth: 0 }}
                  onClick={() => setOpenId(open ? null : it.id)}
                  aria-expanded={open}
                >
                  <span
                    className="sr-muted"
                    style={{ fontSize: 'var(--sr-text-sm)', display: 'block', overflowWrap: 'anywhere' }}
                  >
                    {new Date(it.createdAt).toLocaleString('zh-TW')} · {providerLabel(it.provider)}
                    {it.projectName ? ` · ${it.projectName}` : ''}
                    {it.versionLabel ? ` · ${it.versionLabel}` : ''}
                    {it.model ? ` · ${it.model}` : ''}
                  </span>
                  <span style={{ overflowWrap: 'anywhere' }}>
                    {open ? '▾ ' : '▸ '}
                    {it.summary.split('\n')[0]?.slice(0, 60) || '（無內容）'}
                    {!open && it.summary.length > 60 ? '…' : ''}
                  </span>
                </button>
                {open && (
                  <div style={{ marginTop: 'var(--sr-space-2)', minWidth: 0 }}>
                    {it.summary.split('\n').map((line, i) =>
                      line.trim() ? (
                        <p key={i} style={{ margin: '0 0 var(--sr-space-2)', overflowWrap: 'anywhere' }}>
                          {line}
                        </p>
                      ) : null,
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string }

/**
 * 跟 AI 聊「這件作品」。複用既有 agent 管線（不重建 AI/記憶）：
 * - 綁定：訊息帶 designFileId → 伺服器寫進 context_refs；開啟時用 /api/design/work-thread 找回。
 * - 第一輪：走 /api/agent/chat（非串流、多模態），attachmentAssetIds 帶作品圖 → AI 真的「看得到」
 *   （反幻覺 prompt 禁止描述沒附上的圖，所以必須附圖而不只傳 selectedSnapshotId）。
 * - 之後：走 /api/agent/chat/stream（逐字串流），帶 selectedSnapshotId + route:'/works'。
 * - 長期記憶由 buildAgentContext 在 memory_enabled 時自動注入；這裡不建任何記憶，只在關閉時給提示。
 */
function WorkChat({
  spaceId,
  fileId,
  seedSnapshot,
  memoryEnabled,
}: {
  spaceId: string
  fileId: string
  seedSnapshot: Snapshot | null
  memoryEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  // 開啟時載入這件作品既有對話（找回 thread → 讀訊息）
  useEffect(() => {
    if (!open || loaded) return
    let alive = true
    void (async () => {
      try {
        const res = await fetch(`/api/design/work-thread?fileId=${fileId}`, {
          headers: { 'x-space-id': spaceId },
        })
        if (!res.ok || !alive) return
        const { data } = (await res.json()) as { data: { threadId: string | null } }
        if (!data.threadId || !alive) {
          setLoaded(true)
          return
        }
        setThreadId(data.threadId)
        const r2 = await fetch(`/api/agent/threads/${data.threadId}`, { headers: { 'x-space-id': spaceId } })
        if (!r2.ok || !alive) return
        const b2 = (await r2.json()) as { data: { messages: ChatMsg[] } }
        setMessages(b2.data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })))
      } finally {
        if (alive) {
          setLoaded(true)
          scrollToBottom()
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [open, loaded, fileId, spaceId, scrollToBottom])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setErr(null)
    setBusy(true)
    const optimistic: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()

    // 第一輪（還沒有 thread）：非串流 + 附作品圖，讓 AI 真的看得到這件作品。
    if (!threadId) {
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: text,
            designFileId: fileId,
            route: '/works',
            ...(seedSnapshot
              ? { attachmentAssetIds: [seedSnapshot.asset_id], selectedSnapshotId: seedSnapshot.id }
              : {}),
          }),
        })
        const body: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          setErr((body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。')
          setInput(text)
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
          return
        }
        const data = (body as { data: { threadId: string; reply: string } }).data
        setThreadId(data.threadId)
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.reply }])
        scrollToBottom()
      } catch {
        setErr('網路錯誤，請重試。')
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      } finally {
        setBusy(false)
      }
      return
    }

    // 之後：串流（逐字吐）
    const assistantId = `a-${Date.now()}`
    let full = ''
    let started = false
    try {
      const res = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: text,
          designFileId: fileId,
          route: '/works',
          ...(seedSnapshot ? { selectedSnapshotId: seedSnapshot.id } : {}),
        }),
      })
      if (!res.ok || !res.body) {
        const body: unknown = await res.json().catch(() => null)
        setErr((body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。')
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const blk of blocks) {
          const line = blk.trim()
          if (!line.startsWith('data:')) continue
          let obj: { delta?: string; error?: string; done?: boolean }
          try {
            obj = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (obj.delta) {
            full += obj.delta
            if (!started) {
              started = true
              setStreaming(true)
              setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: full }])
            } else {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)))
            }
            scrollToBottom()
          }
          if (obj.error) setErr(obj.error)
        }
      }
      if (!full) {
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }
    } catch {
      if (!full) {
        setErr('網路錯誤，請重試。')
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }
    } finally {
      setStreaming(false)
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        <button type="button" className="sr-button sr-button-secondary" onClick={() => setOpen(true)}>
          💬 跟 AI 聊這個作品
        </button>
      </div>
    )
  }

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)', minWidth: 0 }}>
      <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>跟 AI 聊這個作品</strong>
        <button type="button" className="sr-linkish" onClick={() => setOpen(false)}>
          收合
        </button>
      </div>

      {!memoryEnabled && (
        <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)', overflowWrap: 'anywhere' }}>
          開啟記憶後，AI 會記得跨對話的重點。{' '}
          <a href="/settings/memory" className="sr-linkish">
            前往設定
          </a>
        </p>
      )}

      <div
        ref={listRef}
        className="sr-stack"
        aria-live="polite"
        style={{
          gap: 'var(--sr-space-2)',
          maxHeight: 320,
          overflowY: 'auto',
          minWidth: 0,
          padding: 'var(--sr-space-2)',
          background: 'var(--sr-surface-alt)',
          borderRadius: 'var(--sr-radius-md)',
        }}
      >
        {messages.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0, textAlign: 'center', fontSize: 'var(--sr-text-sm)' }}>
            問問 AI 對這件作品的看法、想怎麼改，或下一步可以做什麼。
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="sr-card"
              style={{
                minWidth: 0,
                overflowWrap: 'anywhere',
                background: m.role === 'user' ? 'var(--sr-surface)' : 'transparent',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
              }}
            >
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', display: 'block' }}>
                {m.role === 'user' ? '你' : 'AI'}
              </span>
              {m.content.split('\n').map((line, i) =>
                line.trim() ? (
                  <p key={i} style={{ margin: 0, overflowWrap: 'anywhere' }}>
                    {line}
                  </p>
                ) : null,
              )}
            </div>
          ))
        )}
        {busy && !streaming && (
          <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
            思考中…
          </p>
        )}
      </div>

      {err && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          {err}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="sr-row"
        style={{ gap: 'var(--sr-space-2)', alignItems: 'flex-end', flexWrap: 'nowrap', minWidth: 0 }}
      >
        <textarea
          className="sr-input"
          rows={2}
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="輸入訊息…（Enter 送出）"
          disabled={busy}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="sr-button" disabled={busy || !input.trim()}>
          送出
        </button>
      </form>
    </div>
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
