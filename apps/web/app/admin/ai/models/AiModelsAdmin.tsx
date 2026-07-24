'use client'

import { useEffect, useState } from 'react'

type Model = {
  id: string
  provider: string
  model_name: string
  display_name: string
  is_active: boolean
  is_free: boolean
  supports_streaming: boolean
  supports_tools: boolean
  supports_vision: boolean
  context_window: number | null
}

const FLAGS: { key: keyof Model; apiKey: string; label: string }[] = [
  { key: 'is_active', apiKey: 'isActive', label: '啟用' },
  { key: 'is_free', apiKey: 'isFree', label: '免費' },
  { key: 'supports_streaming', apiKey: 'supportsStreaming', label: '串流' },
  { key: 'supports_tools', apiKey: 'supportsTools', label: '工具' },
  { key: 'supports_vision', apiKey: 'supportsVision', label: '視覺' },
]

export function AiModelsAdmin() {
  const [rows, setRows] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/ai-models')
    if (!res.ok) {
      setNotice('✕ 無法載入（需要站台管理員身份）。')
      setLoading(false)
      return
    }
    const body = (await res.json()) as { data: Model[] }
    setRows(body.data)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggle(m: Model, flag: (typeof FLAGS)[number]) {
    const next = !m[flag.key]
    // 樂觀更新
    setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, [flag.key]: next } : r)))
    const res = await fetch(`/api/admin/ai-models?id=${m.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [flag.apiKey]: next }),
    })
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, [flag.key]: !next } : r)))
      setNotice('✕ 更新失敗。')
    }
  }

  if (loading) return <p className="sr-muted">載入中…</p>

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-error" role="status">
          {notice}
        </p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>模型</th>
              {FLAGS.map((f) => (
                <th key={f.apiKey} style={{ textAlign: 'center' }}>
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.display_name}</strong>
                  <br />
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                    {m.provider} · {m.model_name}
                    {m.context_window ? ` · ${(m.context_window / 1000).toFixed(0)}k` : ''}
                  </span>
                </td>
                {FLAGS.map((f) => (
                  <td key={f.apiKey} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(m[f.key])}
                      onChange={() => void toggle(m, f)}
                      aria-label={`${m.display_name} ${f.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
