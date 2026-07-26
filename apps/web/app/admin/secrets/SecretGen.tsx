'use client'

import { useEffect, useState } from 'react'

/**
 * Secret 產生器（純前端，crypto.getRandomValues）。
 *
 * 不經過伺服器 —— 產生的隨機值不落地、不進 log。長度以 bytes/字元計，
 * 對應各種用途（見下方說明表）。
 */

type Charset = 'hex' | 'base64' | 'alnum' | 'alpha' | 'digit' | 'symbol'

const CHARSETS: { key: Charset; label: string; note?: string }[] = [
  { key: 'hex', label: 'Hex（0-9a-f）', note: 'env 友善，常見於排程密鑰 / webhook passcode' },
  { key: 'base64', label: 'Base64', note: '加密金鑰慣用（後台的加密主金鑰就是 base64 的 32 bytes）；含 +/=，放進 .env 可能要引號' },
  { key: 'alnum', label: '英數（A-Za-z0-9）', note: 'env 最安全，無跳脫問題' },
  { key: 'alpha', label: '純英（A-Za-z）' },
  { key: 'digit', label: '純數（0-9）' },
  { key: 'symbol', label: '英數＋符號', note: '熵最高，但 .env 可能需跳脫（引號）' },
]

const LENGTHS = [8, 16, 32, 64]

const USAGE: { bytes: number; bits: string; use: string }[] = [
  { bytes: 8, bits: '64-bit', use: '短用途：非機密隨機 id、去重碼、一次性 nonce。不足以當長期機密。' },
  { bytes: 16, bits: '128-bit', use: 'session token、CSRF token、短期簽章。' },
  { bytes: 32, bits: '256-bit', use: '主流機密長度：JWT 簽章密鑰、排程密鑰（本專案要求 ≥32）、AES-256 加密金鑰（後台加密主金鑰／權杖加密金鑰，需 base64 的 32 bytes）、webhook passcode。' },
  { bytes: 64, bits: '512-bit', use: '高價值長期簽章密鑰、需要額外安全邊際的根密鑰。' },
]

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const DIGIT = '0123456789'
const SYMBOL = ALNUM + '!@#$%^&*()-_=+[]{}'
const HEX = '0123456789abcdef'

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

/** 從字元集均勻抽樣（rejection sampling 避免 modulo 偏差）。 */
function fromCharset(charset: string, count: number): string {
  const out: string[] = []
  const max = 256 - (256 % charset.length)
  while (out.length < count) {
    const buf = randomBytes(count - out.length + 8)
    for (const b of buf) {
      if (out.length >= count) break
      if (b < max) out.push(charset[b % charset.length]!)
    }
  }
  return out.join('')
}

function generate(charset: Charset, length: number): string {
  switch (charset) {
    case 'hex':
      return Array.from(randomBytes(length))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    case 'base64': {
      let s = ''
      for (const b of randomBytes(length)) s += String.fromCharCode(b)
      return btoa(s)
    }
    case 'alnum':
      return fromCharset(ALNUM, length)
    case 'alpha':
      return fromCharset(ALPHA, length)
    case 'digit':
      return fromCharset(DIGIT, length)
    case 'symbol':
      return fromCharset(SYMBOL, length)
    default:
      return fromCharset(HEX, length)
  }
}

type SavedNote = {
  id: string
  label: string
  purpose: string | null
  length_bytes: number | null
  encoding: string | null
  created_at: string
}

export function SecretGen() {
  const [charset, setCharset] = useState<Charset>('hex')
  const [length, setLength] = useState(32)
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)

  // 儲存的紀錄（值在 DB 加密存，這裡列表不含值）
  const [saved, setSaved] = useState<SavedNote[]>([])
  const [saveLabel, setSaveLabel] = useState('')
  const [savePurpose, setSavePurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function loadSaved() {
    try {
      const res = await fetch('/api/admin/secrets')
      if (!res.ok) return
      const body = (await res.json()) as { data: SavedNote[] }
      setSaved(body.data)
    } catch {
      /* 列表載入失敗不擋產生器 */
    }
  }

  useEffect(() => {
    void loadSaved()
  }, [])

  function make() {
    setValue(generate(charset, length))
    setCopied(false)
  }

  async function save() {
    if (!value) {
      setNotice({ kind: 'error', text: '先產生一個 secret 再儲存。' })
      return
    }
    if (!saveLabel.trim()) {
      setNotice({ kind: 'error', text: '請給這筆紀錄一個標籤（例如「JWT secret 2026-07」）。' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/secrets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: saveLabel.trim(),
          purpose: savePurpose.trim() || undefined,
          value,
          lengthBytes: length,
          encoding: charset,
        }),
      })
      const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null
      if (!res.ok) {
        setNotice({ kind: 'error', text: `✕ ${body?.error?.message ?? '儲存失敗。'}` })
        return
      }
      setNotice({ kind: 'ok', text: '✓ 已加密儲存這筆紀錄。' })
      setSaveLabel('')
      setSavePurpose('')
      await loadSaved()
    } catch {
      setNotice({ kind: 'error', text: '✕ 網路或伺服器錯誤。' })
    } finally {
      setSaving(false)
    }
  }

  async function reveal(id: string) {
    if (revealed[id]) {
      // 再按一次收起
      setRevealed((r) => {
        const next = { ...r }
        delete next[id]
        return next
      })
      return
    }
    try {
      const res = await fetch(`/api/admin/secrets?id=${encodeURIComponent(id)}`)
      const body = (await res.json().catch(() => null)) as { data?: { value: string }; error?: { message: string } } | null
      if (!res.ok || !body?.data) {
        setNotice({ kind: 'error', text: `✕ ${body?.error?.message ?? '無法讀取。'}` })
        return
      }
      setRevealed((r) => ({ ...r, [id]: body.data!.value }))
    } catch {
      setNotice({ kind: 'error', text: '✕ 網路錯誤。' })
    }
  }

  async function del(id: string) {
    if (!window.confirm('刪除這筆 secret 紀錄？')) return
    const res = await fetch(`/api/admin/secrets?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      setNotice({ kind: 'error', text: '✕ 刪除失敗。' })
      return
    }
    setRevealed((r) => {
      const next = { ...r }
      delete next[id]
      return next
    })
    await loadSaved()
  }

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪貼簿被拒就算了，值還在畫面上可手動複製 */
    }
  }

  const selected = CHARSETS.find((c) => c.key === charset)
  const unit = charset === 'hex' || charset === 'base64' ? 'bytes' : '字元'

  return (
    <div className="sr-stack">
      {notice && (
        <p className={`sr-message ${notice.kind === 'error' ? 'sr-message-error' : 'sr-message-success'}`} role="status">
          {notice.text}
        </p>
      )}

      <section className="sr-card" style={{ padding: 'var(--sr-space-5)' }}>
        <div className="sr-stack">
          <div>
            <label className="sr-label" htmlFor="secret-len">
              長度（{unit}）
            </label>
            <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`sr-button ${length === n ? '' : 'sr-button-secondary'}`}
                  aria-pressed={length === n}
                  onClick={() => setLength(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="sr-label" htmlFor="secret-charset">
              字元組合
            </label>
            <select
              id="secret-charset"
              className="sr-input"
              value={charset}
              onChange={(e) => setCharset(e.target.value as Charset)}
            >
              {CHARSETS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            {selected?.note && (
              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginTop: 4 }}>
                {selected.note}
              </p>
            )}
          </div>

          <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="sr-button" onClick={make}>
              產生
            </button>
            <button type="button" className="sr-button sr-button-secondary" onClick={() => void copy()} disabled={!value}>
              {copied ? '已複製 ✓' : '複製'}
            </button>
          </div>

          {value && (
            <output
              className="sr-input"
              style={{
                display: 'block',
                fontFamily: 'var(--sr-font-mono, ui-monospace, monospace)',
                wordBreak: 'break-all',
                userSelect: 'all',
              }}
            >
              {value}
            </output>
          )}

          {/* 儲存紀錄：值會加密後存 DB（reveal 時才解密） */}
          {value && (
            <div
              className="sr-stack"
              style={{
                borderTop: 'var(--sr-border-width) solid var(--sr-border)',
                paddingTop: 'var(--sr-space-4)',
              }}
            >
              <input
                className="sr-input"
                placeholder="標籤（例如「JWT secret 2026-07」）"
                value={saveLabel}
                maxLength={120}
                onChange={(e) => setSaveLabel(e.target.value)}
              />
              <input
                className="sr-input"
                placeholder="用途備註（選填）"
                value={savePurpose}
                maxLength={500}
                onChange={(e) => setSavePurpose(e.target.value)}
              />
              <div>
                <button type="button" className="sr-button sr-button-secondary" onClick={() => void save()} disabled={saving}>
                  {saving ? '儲存中…' : '加密儲存這筆'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--sr-text-h3, 1.25rem)' }}>各長度用途</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>長度</th>
                <th style={{ textAlign: 'left' }}>強度</th>
                <th style={{ textAlign: 'left' }}>典型用途</th>
              </tr>
            </thead>
            <tbody>
              {USAGE.map((u) => (
                <tr key={u.bytes}>
                  <td>
                    <strong>{u.bytes}</strong>
                  </td>
                  <td className="sr-muted">{u.bits}</td>
                  <td>{u.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 已儲存的 secret 紀錄 ── */}
      <section>
        <h2 style={{ fontSize: 'var(--sr-text-h3, 1.25rem)' }}>已儲存的紀錄（{saved.length}）</h2>
        <p className="sr-muted" style={{ marginTop: 0, fontSize: 'var(--sr-text-sm)' }}>
          值以 AES-256-GCM 加密後存 DB（主金鑰在 env，不在 DB）。列表不含值，按「顯示」才會解密。
        </p>
        {saved.length === 0 ? (
          <p className="sr-muted">還沒有儲存任何紀錄。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>標籤 / 用途</th>
                  <th style={{ textAlign: 'left' }}>格式</th>
                  <th style={{ textAlign: 'left' }}>值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {saved.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.label}</strong>
                      {s.purpose && (
                        <>
                          <br />
                          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                            {s.purpose}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                      {s.encoding ?? '—'}
                      {s.length_bytes ? ` · ${s.length_bytes}` : ''}
                    </td>
                    <td style={{ fontFamily: 'var(--sr-font-mono, ui-monospace, monospace)', wordBreak: 'break-all', userSelect: 'all', maxWidth: 240 }}>
                      {revealed[s.id] ?? '••••••••'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="sr-linkish" onClick={() => void reveal(s.id)}>
                        {revealed[s.id] ? '隱藏' : '顯示'}
                      </button>
                      {' · '}
                      <button type="button" className="sr-linkish" onClick={() => void del(s.id)}>
                        刪除
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
