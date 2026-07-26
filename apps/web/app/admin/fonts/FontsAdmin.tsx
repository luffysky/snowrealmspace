'use client'

import { useEffect, useRef, useState } from 'react'

type Installed = {
  id: string
  slug: string
  family: string
  category: string
  scripts: string[]
  weights: number[]
  enabled: boolean
  firstScreenBytes: number
  license: { name: string; url: string }
}

type Catalogue = {
  slug: string
  family: string
  displayName: string
  category: string
  scripts: string[]
  weights: number[]
  manual: boolean
  license: string
  licenseUrl: string
  installed: boolean
  sourceHint: string
}

function kb(bytes: number): string {
  return bytes > 0 ? `${(bytes / 1024).toFixed(1)} KB` : '—'
}

export function FontsAdmin() {
  const [installed, setInstalled] = useState<Installed[]>([])
  const [catalogue, setCatalogue] = useState<Catalogue[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const fontInputRef = useRef<HTMLInputElement>(null)
  const licenseInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch('/api/admin/fonts')
    if (!res.ok) {
      setNotice({ kind: 'error', text: '無法載入（需要站台管理員身份）。' })
      setLoading(false)
      return
    }
    const body = (await res.json()) as { data: { installed: Installed[]; catalogue: Catalogue[] } }
    setInstalled(body.data.installed)
    setCatalogue(body.data.catalogue)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const notInstalled = catalogue.filter((c) => !c.installed)
  const selected = catalogue.find((c) => c.slug === slug) ?? null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!slug) {
      setNotice({ kind: 'error', text: '請先選擇要安裝的字體。' })
      return
    }
    const fontFiles = fontInputRef.current?.files
    const licenseFileList = licenseInputRef.current?.files
    if (!fontFiles || fontFiles.length === 0) {
      setNotice({ kind: 'error', text: '請選擇字體檔（.ttf / .otf）。' })
      return
    }
    if (!licenseFileList || licenseFileList.length === 0) {
      setNotice({ kind: 'error', text: 'OFL 要求授權全文隨字體散布，請一併選擇授權檔。' })
      return
    }

    const form = new FormData()
    form.set('slug', slug)
    for (const f of Array.from(fontFiles)) form.append('fonts', f)
    form.set('license', licenseFileList[0]!)

    setBusy(true)
    setNotice({ kind: 'ok', text: '處理中… 中文字體子集化需要數十秒，請不要關閉頁面。' })
    try {
      const res = await fetch('/api/admin/fonts', { method: 'POST', body: form })
      const body = (await res.json().catch(() => null)) as
        | { data?: { family: string; weights: number[]; sliceCount: number; firstScreenBytes: number } }
        | { error?: { message: string } }
        | null
      if (!res.ok) {
        const msg = (body && 'error' in body && body.error?.message) || '安裝失敗。'
        setNotice({ kind: 'error', text: `✕ ${msg}` })
        return
      }
      const d = body && 'data' in body ? body.data : undefined
      setNotice({
        kind: 'ok',
        text: d
          ? `✓ 已安裝 ${d.family}：${d.weights.length} 字重、${d.sliceCount} 分片，首屏 ${kb(d.firstScreenBytes)}。`
          : '✓ 已安裝。',
      })
      setSlug('')
      if (fontInputRef.current) fontInputRef.current.value = ''
      if (licenseInputRef.current) licenseInputRef.current.value = ''
      await load()
    } catch {
      setNotice({ kind: 'error', text: '✕ 網路或伺服器錯誤。' })
    } finally {
      setBusy(false)
    }
  }

  async function toggle(f: Installed) {
    const next = !f.enabled
    setInstalled((rs) => rs.map((r) => (r.slug === f.slug ? { ...r, enabled: next } : r)))
    const res = await fetch(`/api/admin/fonts?slug=${encodeURIComponent(f.slug)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    if (!res.ok) {
      setInstalled((rs) => rs.map((r) => (r.slug === f.slug ? { ...r, enabled: !next } : r)))
      setNotice({ kind: 'error', text: '✕ 更新失敗。' })
    }
  }

  async function remove(f: Installed) {
    if (!window.confirm(`確定移除「${f.family}」？會刪掉 R2 上的分片，前台將無法再選用這套字體。`)) return
    const res = await fetch(`/api/admin/fonts?slug=${encodeURIComponent(f.slug)}`, { method: 'DELETE' })
    if (!res.ok) {
      setNotice({ kind: 'error', text: '✕ 移除失敗。' })
      return
    }
    setNotice({ kind: 'ok', text: `✓ 已移除 ${f.family}。` })
    await load()
  }

  if (loading) return <p className="sr-muted">載入中…</p>

  return (
    <div className="sr-stack">
      {notice && (
        <p
          className={`sr-message ${notice.kind === 'error' ? 'sr-message-error' : 'sr-message-success'}`}
          role="status"
        >
          {notice.text}
        </p>
      )}

      {/* ── 安裝字體 ── */}
      <section className="sr-card" style={{ padding: 'var(--sr-space-5)' }}>
        <h2 style={{ marginTop: 0, fontSize: 'var(--sr-text-h3, 1.25rem)' }}>安裝字體</h2>
        <p className="sr-muted" style={{ marginTop: 0 }}>
          只接受內建目錄中的 OFL 授權字體（授權範圍可驗證）。多數字體用{' '}
          <code>pnpm tsx scripts/download-fonts.ts</code> 自動安裝；這裡是給沒有穩定下載網址、需人工取得的字體
          （例如台北黑體）。字體檔與授權全文都要一起上傳。
        </p>

        <form onSubmit={submit} className="sr-stack" style={{ marginTop: 'var(--sr-space-4)' }}>
          <div>
            <label className="sr-label" htmlFor="font-slug">
              字體
            </label>
            <select
              id="font-slug"
              className="sr-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={busy}
            >
              <option value="">— 選擇要安裝的字體 —</option>
              {notInstalled.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.displayName}
                  {c.manual ? '（需人工下載）' : ''}
                </option>
              ))}
            </select>
            {notInstalled.length === 0 && (
              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                目錄中的字體都已安裝。
              </p>
            )}
          </div>

          {selected && (
            <div
              className="sr-muted"
              style={{
                fontSize: 'var(--sr-text-sm)',
                padding: 'var(--sr-space-3)',
                background: 'var(--sr-surface-alt)',
                borderRadius: 'var(--sr-radius-sm)',
              }}
            >
              <div>
                字重：{selected.weights.join(' / ')} · 語系：{selected.scripts.join('、')} · 授權：{selected.license}
              </div>
              <div>來源：{selected.sourceHint}</div>
              {selected.manual && (
                <div style={{ marginTop: 4 }}>
                  下載後會有數個字重檔（.ttf/.otf）與一份 OFL 授權；請把{' '}
                  <strong>{selected.weights.length}</strong> 個字重檔一次選起來，並選擇授權檔。
                </div>
              )}
            </div>
          )}

          <div>
            <label className="sr-label" htmlFor="font-files">
              字體檔（.ttf / .otf，可多選）
            </label>
            <input id="font-files" ref={fontInputRef} type="file" accept=".ttf,.otf" multiple disabled={busy} style={{ maxWidth: '100%' }} />
          </div>

          <div>
            <label className="sr-label" htmlFor="license-file">
              授權全文（OFL.txt / LICENSE，必填）
            </label>
            <input id="license-file" ref={licenseInputRef} type="file" accept=".txt,.md,text/plain" disabled={busy} style={{ maxWidth: '100%' }} />
          </div>

          <div>
            <button type="submit" className="sr-button" disabled={busy || !slug}>
              {busy ? '處理中…' : '上傳並安裝'}
            </button>
          </div>
        </form>
      </section>

      {/* ── 已安裝 ── */}
      <section>
        <h2 style={{ fontSize: 'var(--sr-text-h3, 1.25rem)' }}>已安裝字體（{installed.length}）</h2>
        {installed.length === 0 ? (
          <p className="sr-muted">還沒有任何字體。用上方表單安裝，或跑 CLI。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>字體</th>
                  <th style={{ textAlign: 'left' }}>字重</th>
                  <th style={{ textAlign: 'left' }}>首屏</th>
                  <th style={{ textAlign: 'center' }}>啟用</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {installed.map((f) => (
                  <tr key={f.slug}>
                    <td>
                      <strong>{f.family}</strong>
                      <br />
                      <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                        {f.category} · {f.scripts.join('、')} ·{' '}
                        <a href={f.license.url} target="_blank" rel="noreferrer" className="sr-link">
                          {f.license.name}
                        </a>
                      </span>
                    </td>
                    <td>{f.weights.join(' / ')}</td>
                    <td>{kb(f.firstScreenBytes)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => void toggle(f)}
                        aria-label={`${f.family} 啟用`}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="sr-linkish" onClick={() => void remove(f)}>
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
