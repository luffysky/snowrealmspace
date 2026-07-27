'use client'

import { useState } from 'react'

export type ContentRow = {
  content_id: string
  kind: string
  label: string | null
  text: string
  enabled: boolean
  weight: number
  rarity: string | null
  tags: string[]
}

const KIND_LABEL: Record<string, string> = {
  quote: '語錄',
  prompt: '創作提示',
  question: '每日一問',
  micro_action: '微行動',
  seasonal: '季節·節氣',
  milestone: '里程碑回顧',
  welcome: '歡迎鏈',
  greeting: '問候',
  surprise: '驚喜',
  chain: '生日鏈',
}
const ADDABLE = ['quote', 'prompt', 'question', 'micro_action', 'seasonal', 'milestone', 'welcome', 'greeting', 'surprise'] as const
const PAGE = 100

/** 每一類的展開狀態（懶載入 + 分頁）。 */
type KindState = {
  items: ContentRow[]
  total: number // 符合搜尋條件的總數（未搜尋時＝該類全部）
  loaded: boolean
  loading: boolean
  q: string
  tag: string // 標籤篩選（詳細分類）
}

const emptyKind = (): KindState => ({ items: [], total: 0, loaded: false, loading: false, q: '', tag: '' })

export function ContentAdmin({ counts }: { counts: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null)
  const [state, setState] = useState<Record<string, KindState>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  // add form
  const [kind, setKind] = useState<(typeof ADDABLE)[number]>('quote')
  const [text, setText] = useState('')
  const [weight, setWeight] = useState('1')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  function say(m: string, isErr = false) {
    setMsg(m)
    setError(isErr)
  }

  const patchKind = (k: string, patch: Partial<KindState>) =>
    setState((s) => ({ ...s, [k]: { ...(s[k] ?? emptyKind()), ...patch } }))

  /** 拉某一類的一頁；offset=0 代表重新載入（換搜尋詞/標籤或首次展開）。 */
  async function load(k: string, offset: number, q: string, tag = '') {
    patchKind(k, { loading: true })
    try {
      const url = `/api/admin/content?kind=${k}&offset=${offset}&limit=${PAGE}&q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`
      const res = await fetch(url)
      const json = (await res.json()) as {
        data?: { items: ContentRow[]; total: number }
        error?: { message?: string }
      }
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? '讀取失敗')
      setState((s) => {
        const prev = s[k] ?? emptyKind()
        const items = offset === 0 ? json.data!.items : [...prev.items, ...json.data!.items]
        return { ...s, [k]: { ...prev, items, total: json.data!.total, loaded: true, loading: false, q, tag } }
      })
    } catch (e) {
      patchKind(k, { loading: false })
      say(e instanceof Error ? e.message : '讀取失敗', true)
    }
  }

  function toggle(k: string) {
    const next = open === k ? null : k
    setOpen(next)
    if (next && !state[k]?.loaded) void load(k, 0, '')
  }

  async function add() {
    if (!text.trim()) return
    setBusy(true)
    say('')
    try {
      const payload: Record<string, unknown> = { kind, text, weight: Number(weight) || 1 }
      if (kind === 'surprise') payload.label = label || '一個驚喜'
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json: { data?: ContentRow; error?: { message?: string } } = await res.json()
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? '新增失敗')
      // 若該類已展開載入，就把新項插到最前並讓總數 +1
      setState((s) => {
        const prev = s[kind]
        if (!prev?.loaded) return s
        return { ...s, [kind]: { ...prev, items: [json.data!, ...prev.items], total: prev.total + 1 } }
      })
      setText('')
      setLabel('')
      say('已新增。展開該類即可看到。')
    } catch (e) {
      say(e instanceof Error ? e.message : '新增失敗', true)
    } finally {
      setBusy(false)
    }
  }

  async function patch(row: ContentRow, p: { enabled?: boolean; text?: string; weight?: number }) {
    setState((s) => {
      const st = s[row.kind]
      if (!st) return s
      return { ...s, [row.kind]: { ...st, items: st.items.map((r) => (r.content_id === row.content_id ? { ...r, ...p } : r)) } }
    })
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentId: row.content_id, ...p }),
      })
      if (!res.ok) {
        const j: { error?: { message?: string } } = await res.json()
        throw new Error(j.error?.message ?? '更新失敗')
      }
    } catch (e) {
      // 失敗回滾：把這一項改回原值
      setState((s) => {
        const st = s[row.kind]
        if (!st) return s
        return { ...s, [row.kind]: { ...st, items: st.items.map((r) => (r.content_id === row.content_id ? row : r)) } }
      })
      say(e instanceof Error ? e.message : '更新失敗', true)
    }
  }

  async function remove(row: ContentRow) {
    setState((s) => {
      const st = s[row.kind]
      if (!st) return s
      return { ...s, [row.kind]: { ...st, items: st.items.filter((r) => r.content_id !== row.content_id), total: Math.max(0, st.total - 1) } }
    })
    try {
      const res = await fetch(`/api/admin/content?contentId=${encodeURIComponent(row.content_id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const j: { error?: { message?: string } } = await res.json()
        throw new Error(j.error?.message ?? '刪除失敗')
      }
    } catch (e) {
      // 失敗回滾：重新載入該類第一頁最單純
      void load(row.kind, 0, state[row.kind]?.q ?? '', state[row.kind]?.tag ?? '')
      say(e instanceof Error ? e.message : '刪除失敗', true)
    }
  }

  const kinds = Object.keys(KIND_LABEL).filter((k) => (counts[k] ?? 0) > 0 || k !== 'chain')

  return (
    <>
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">新增文案</h2>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select className="sr-input" style={{ flex: '0 0 auto' }} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {ADDABLE.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input className="sr-input" style={{ flex: '3 1 240px' }} placeholder="文字" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
          {kind === 'surprise' && (
            <input className="sr-input" style={{ flex: '1 1 120px' }} placeholder="盒子外觀文字" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
          )}
          <input className="sr-input" style={{ flex: '0 0 70px' }} type="number" step="0.1" min="0.1" placeholder="權重" value={weight} disabled={busy} onChange={(e) => setWeight(e.target.value)} />
          <button type="button" className="sr-button" disabled={busy || !text.trim()} onClick={() => void add()}>
            新增
          </button>
        </div>
        {msg && (
          <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, ...(error ? { color: 'var(--sr-danger)' } : {}) }}>
            {msg}
          </p>
        )}
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-xs)' }}>
          新增的文字一樣會過內容安全過濾。
        </p>
      </section>

      {kinds.map((k) => {
        const st = state[k]
        const isOpen = open === k
        const total = counts[k] ?? 0
        return (
          <section key={k} className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
            <button
              type="button"
              onClick={() => toggle(k)}
              aria-expanded={isOpen}
              className="sr-section-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--sr-space-2)',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>
                {KIND_LABEL[k] ?? k}{' '}
                <span className="sr-muted" style={{ fontWeight: 400 }}>（{total.toLocaleString()}）</span>
              </span>
              <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <>
                <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-3)', flexWrap: 'wrap' }}>
                  <input
                    className="sr-input"
                    style={{ flex: '2 1 200px' }}
                    placeholder="搜尋這一類的文字…"
                    defaultValue={st?.q ?? ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void load(k, 0, (e.target as HTMLInputElement).value.trim(), st?.tag ?? '')
                    }}
                  />
                  <input
                    className="sr-input"
                    style={{ flex: '1 1 140px' }}
                    placeholder="篩選標籤（如 solitude）"
                    defaultValue={st?.tag ?? ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void load(k, 0, st?.q ?? '', (e.target as HTMLInputElement).value.trim())
                    }}
                  />
                  {st?.tag ? (
                    <button
                      type="button"
                      className="sr-button sr-button-secondary"
                      style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }}
                      onClick={() => void load(k, 0, st?.q ?? '', '')}
                    >
                      清除標籤：{st.tag}
                    </button>
                  ) : null}
                </div>

                {st?.loading && !st.items.length ? (
                  <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)' }}>載入中…</p>
                ) : (
                  <>
                    <ul
                      className="sr-stack"
                      style={{ margin: 'var(--sr-space-3) 0 0', padding: 0, listStyle: 'none', gap: 'var(--sr-space-2)' }}
                    >
                      {(st?.items ?? []).map((r) => (
                        <ContentItemRow key={r.content_id} row={r} onPatch={patch} onRemove={remove} />
                      ))}
                    </ul>
                    {st && (
                      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', marginBottom: 0, fontSize: 'var(--sr-text-xs)' }}>
                        顯示 {st.items.length.toLocaleString()} / {st.total.toLocaleString()} 則
                        {st.q || st.tag ? '（篩選結果）' : ''}
                        {st.items.length < st.total && (
                          <>
                            {' · '}
                            <button
                              type="button"
                              className="sr-linkish"
                              disabled={st.loading}
                              onClick={() => void load(k, st.items.length, st.q, st.tag)}
                            >
                              {st.loading ? '載入中…' : '載入更多'}
                            </button>
                          </>
                        )}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )
      })}
    </>
  )
}

function ContentItemRow({
  row,
  onPatch,
  onRemove,
}: {
  row: ContentRow
  onPatch: (row: ContentRow, p: { enabled?: boolean; text?: string; weight?: number }) => void
  onRemove: (row: ContentRow) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(row.text)
  const [weight, setWeight] = useState(String(row.weight))
  const isChain = row.kind === 'chain'

  return (
    <li style={{ opacity: row.enabled ? 1 : 0.5, borderTop: '1px solid var(--sr-border)', paddingTop: 'var(--sr-space-2)' }}>
      {editing ? (
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input className="sr-input" style={{ flex: '3 1 240px' }} value={text} onChange={(e) => setText(e.target.value)} />
          <input className="sr-input" style={{ flex: '0 0 70px' }} type="number" step="0.1" min="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <button
            type="button"
            className="sr-button"
            style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }}
            onClick={() => {
              onPatch(row, { text, weight: Number(weight) || 1 })
              setEditing(false)
            }}
          >
            存
          </button>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }} onClick={() => { setText(row.text); setWeight(String(row.weight)); setEditing(false) }}>
            取消
          </button>
        </div>
      ) : (
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ flex: 1, fontSize: 'var(--sr-text-sm)', minWidth: 180 }}>{row.text}</span>
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
            權重 {row.weight}
            {row.rarity ? `·${row.rarity}` : ''}
            {row.tags.length ? `·${row.tags.join('/')}` : ''}
          </span>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }} onClick={() => onPatch(row, { enabled: !row.enabled })}>
            {row.enabled ? '啟用中' : '已停用'}
          </button>
          {!isChain && (
            <>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }} onClick={() => setEditing(true)}>
                編輯
              </button>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)', color: 'var(--sr-danger)' }} onClick={() => onRemove(row)}>
                刪除
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}
