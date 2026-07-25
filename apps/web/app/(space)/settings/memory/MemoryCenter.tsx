'use client'

import { useState } from 'react'
import { useDialog } from '@/components/ui/DialogProvider'
import { MEMORY_SENSITIVITY, type MemorySensitivity } from '@snowrealm/validation'

export type MemoryRow = {
  id: string
  type: string
  content: string
  source_type: string
  sensitivity: MemorySensitivity
  approved: boolean
  created_at: string
  updated_at: string
}

const SENSITIVITY_LABEL: Record<MemorySensitivity, string> = {
  normal: '一般',
  private: '私密',
  restricted: '限制（永不進對話）',
}

export function MemoryCenter({
  spaceId,
  initialMemories,
  memoryEnabled,
}: {
  spaceId: string
  initialMemories: MemoryRow[]
  memoryEnabled: boolean
}) {
  const { confirm, prompt } = useDialog()
  const [memories, setMemories] = useState<MemoryRow[]>(initialMemories)
  const [notice, setNotice] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<{
    mode: 'semantic' | 'keyword'
    items: { id: string; content: string; similarity: number | null }[]
  } | null>(null)

  const headers = { 'x-space-id': spaceId, 'content-type': 'application/json' }
  const approved = memories.filter((m) => m.approved)
  const pending = memories.filter((m) => !m.approved)

  async function addMemory(e: React.FormEvent) {
    e.preventDefault()
    if (!newContent.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: newContent.trim() }),
      })
      if (!res.ok) {
        setNotice('✕ 新增失敗。')
        return
      }
      const body = (await res.json()) as { data: MemoryRow }
      setMemories((prev) => [body.data, ...prev])
      setNewContent('')
      setNotice('已新增。')
    } finally {
      setBusy(false)
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await fetch(`/api/memories/search?q=${encodeURIComponent(q)}`, { headers })
      if (!res.ok) {
        setNotice('✕ 檢索失敗。')
        return
      }
      const body = (await res.json()) as {
        data: { mode: 'semantic' | 'keyword'; results: { id: string; content: string; similarity: number | null }[] }
      }
      setResults({ mode: body.data.mode, items: body.data.results })
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setResults(null)
  }

  async function act(id: string, path: string, method: string): Promise<boolean> {
    const res = await fetch(`/api/memories/${id}${path}`, { method, headers })
    return res.ok
  }

  async function approve(m: MemoryRow) {
    if (await act(m.id, '/approve', 'POST')) {
      setMemories((prev) => prev.map((x) => (x.id === m.id ? { ...x, approved: true } : x)))
      setNotice('已批准，Agent 之後可以用上它。')
    }
  }
  async function reject(m: MemoryRow) {
    if (await act(m.id, '/reject', 'POST')) {
      setMemories((prev) => prev.filter((x) => x.id !== m.id))
      setNotice('已拒絕。')
    }
  }
  async function remove(m: MemoryRow) {
    if (!(await confirm({ title: '刪除記憶', message: '刪除這則記憶？', danger: true, confirmText: '刪除' }))) return
    if (await act(m.id, '', 'DELETE')) {
      setMemories((prev) => prev.filter((x) => x.id !== m.id))
      setNotice('已刪除。')
    }
  }

  async function editContent(m: MemoryRow) {
    const content = await prompt({ title: '編輯記憶', defaultValue: m.content, multiline: true })
    if (content === null || !content.trim()) return
    const res = await fetch(`/api/memories/${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: content.trim() }),
    })
    if (res.ok) {
      setMemories((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: content.trim() } : x)))
    }
  }

  async function changeSensitivity(m: MemoryRow, sensitivity: MemorySensitivity) {
    const res = await fetch(`/api/memories/${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sensitivity }),
    })
    if (res.ok) setMemories((prev) => prev.map((x) => (x.id === m.id ? { ...x, sensitivity } : x)))
  }

  async function deleteAll() {
    if (!(await confirm({ title: '刪除全部記憶', message: `確定刪除全部 ${approved.length + pending.length} 則記憶？此動作無法復原。`, danger: true, confirmText: '全部刪除' }))) return
    setBusy(true)
    try {
      await Promise.all(memories.map((m) => act(m.id, '', 'DELETE')))
      setMemories([])
      setNotice('已清空所有記憶。')
    } finally {
      setBusy(false)
    }
  }

  function exportJson() {
    const payload = approved.map((m) => ({
      content: m.content,
      type: m.type,
      sensitivity: m.sensitivity,
      createdAt: m.created_at,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snowrealm-memories.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function Item({ m }: { m: MemoryRow }) {
    return (
      <li className="sr-card sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
        <p style={{ margin: 0 }}>{m.content}</p>
        <div className="sr-chip-row">
          <span className="sr-chip sr-chip-tag">{m.type}</span>
          <select
            className="sr-input"
            style={{ maxWidth: 200 }}
            value={m.sensitivity}
            onChange={(e) => void changeSensitivity(m, e.target.value as MemorySensitivity)}
            aria-label="敏感度"
          >
            {MEMORY_SENSITIVITY.map((s) => (
              <option key={s} value={s}>
                {SENSITIVITY_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="sr-btn-row">
          <button type="button" className="sr-timeline-action" onClick={() => void editContent(m)}>
            編輯
          </button>
          <button type="button" className="sr-timeline-action" onClick={() => void remove(m)}>
            刪除
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      {!memoryEnabled && (
        <section className="sr-card">
          <p style={{ margin: 0 }}>
            記憶功能目前<strong>關閉</strong>中。Agent 不會提議或使用記憶。
            {memories.length > 0 && ` 你仍保留了 ${memories.length} 則記憶，可在下方查看或刪除。`}
          </p>
          <p className="sr-muted" style={{ marginBottom: 0 }}>
            要開啟記憶，到「設定 → 隱私」把「記憶」打開。
          </p>
        </section>
      )}

      {/* 待批准提案 */}
      {pending.length > 0 && (
        <section className="sr-card sr-stack">
          <h2 className="sr-section-title">Agent 想記住這些（待你批准）</h2>
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pending.map((m) => (
              <li key={m.id} className="sr-card sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
                <p style={{ margin: 0 }}>{m.content}</p>
                <div className="sr-btn-row">
                  <button type="button" className="sr-button" onClick={() => void approve(m)}>
                    批准
                  </button>
                  <button type="button" className="sr-button sr-button-secondary" onClick={() => void reject(m)}>
                    不需要
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 新增 */}
      <form className="sr-card sr-stack" onSubmit={addMemory}>
        <h2 className="sr-section-title">自己加一則</h2>
        <textarea
          className="sr-input"
          rows={2}
          value={newContent}
          maxLength={1000}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="例如：我偏好暖色調、喜歡留白多一點的版面"
        />
        <div className="sr-btn-row">
          <button type="submit" className="sr-button" disabled={busy || !newContent.trim()}>
            新增
          </button>
        </div>
      </form>

      {/* 語意檢索 */}
      {approved.length > 0 && (
        <form className="sr-card sr-stack" onSubmit={search}>
          <h2 className="sr-section-title">語意搜尋</h2>
          <p className="sr-muted" style={{ margin: 0 }}>
            用意思找，不只是關鍵字。例如搜「喜歡什麼顏色」也能找到「偏好暖色調」。
          </p>
          <div className="sr-btn-row" style={{ gap: 'var(--sr-space-2)' }}>
            <input
              className="sr-input"
              style={{ flex: 1, minWidth: 0 }}
              value={query}
              maxLength={500}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="想找什麼記憶？"
              aria-label="語意搜尋"
            />
            <button type="submit" className="sr-button" disabled={searching || !query.trim()}>
              {searching ? '搜尋中…' : '搜尋'}
            </button>
            {results && (
              <button type="button" className="sr-button sr-button-secondary" onClick={clearSearch}>
                清除
              </button>
            )}
          </div>

          {results && (
            <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
              <p className="sr-muted" style={{ margin: 0 }}>
                {results.items.length === 0
                  ? '沒有相關的記憶。'
                  : results.mode === 'semantic'
                    ? `語意相關的 ${results.items.length} 則：`
                    : `關鍵字比對（未設向量金鑰）的 ${results.items.length} 則：`}
              </p>
              {results.items.length > 0 && (
                <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {results.items.map((r) => (
                    <li key={r.id} className="sr-card" style={{ display: 'flex', gap: 'var(--sr-space-2)', alignItems: 'baseline' }}>
                      {r.similarity !== null && (
                        <span className="sr-chip sr-chip-tag" style={{ flexShrink: 0 }}>
                          {Math.round(r.similarity * 100)}%
                        </span>
                      )}
                      <span style={{ minWidth: 0 }}>{r.content}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      )}

      {/* 已批准 */}
      <section className="sr-stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sr-space-2)' }}>
          <h2 className="sr-section-title" style={{ margin: 0 }}>
            已保存的記憶（{approved.length}）
          </h2>
          {memories.length > 0 && (
            <div className="sr-btn-row">
              <button type="button" className="sr-button sr-button-secondary" onClick={exportJson}>
                匯出 JSON
              </button>
              <button type="button" className="sr-button sr-button-danger" onClick={() => void deleteAll()} disabled={busy}>
                全部刪除
              </button>
            </div>
          )}
        </div>

        {approved.length === 0 ? (
          <p className="sr-muted">還沒有已保存的記憶。</p>
        ) : (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {approved.map((m) => (
              <Item key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
