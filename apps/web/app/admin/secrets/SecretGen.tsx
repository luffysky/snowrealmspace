'use client'

import { useState } from 'react'

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

export function SecretGen() {
  const [charset, setCharset] = useState<Charset>('hex')
  const [length, setLength] = useState(32)
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)

  function make() {
    setValue(generate(charset, length))
    setCopied(false)
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
    </div>
  )
}
