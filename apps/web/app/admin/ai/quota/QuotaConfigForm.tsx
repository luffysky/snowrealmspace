'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 全域每日額度上限編輯（站台管理員）。
 * 原本寫死 deps.ts；現改讀 ai_quota_config，這裡可調。
 */
export function QuotaConfigForm({ initial }: { initial: { freeDailyCap: number; paidDailyCap: number } }) {
  const router = useRouter()
  const [free, setFree] = useState(String(initial.freeDailyCap))
  const [paid, setPaid] = useState(String(initial.paidDailyCap))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const dirty = free !== String(initial.freeDailyCap) || paid !== String(initial.paidDailyCap)

  async function save() {
    const freeDailyCap = Number(free)
    const paidDailyCap = Number(paid)
    if (!Number.isInteger(freeDailyCap) || !Number.isInteger(paidDailyCap) || freeDailyCap < 0 || paidDailyCap < 0) {
      setError(true)
      setMsg('請輸入 0 以上的整數。')
      return
    }
    setBusy(true)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/ai-quota-config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ freeDailyCap, paidDailyCap }),
      })
      const json: { error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '更新失敗')
      setMsg('已更新。')
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sr-card" style={{ padding: 'var(--sr-space-4)', marginTop: 'var(--sr-space-4)' }}>
      <h2 className="sr-section-title">每日上限</h2>
      <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
        超過上限時該類呼叫會被擋下（免費層寬鬆、付費層保守）。改動即時生效於之後的呼叫。
      </p>
      <div className="sr-form-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-3)' }}>
        <label className="sr-stack" style={{ gap: 'var(--sr-space-1)' }}>
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>免費呼叫／日</span>
          <input
            className="sr-input"
            type="number"
            min={0}
            inputMode="numeric"
            value={free}
            disabled={busy}
            onChange={(e) => setFree(e.target.value)}
          />
        </label>
        <label className="sr-stack" style={{ gap: 'var(--sr-space-1)' }}>
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>付費呼叫／日</span>
          <input
            className="sr-input"
            type="number"
            min={0}
            inputMode="numeric"
            value={paid}
            disabled={busy}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-3)' }}>
        <button type="button" className="sr-button" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? '儲存中…' : '儲存'}
        </button>
        {msg && (
          <span className="sr-muted" style={error ? { color: 'var(--sr-danger)' } : undefined}>
            {msg}
          </span>
        )}
      </div>
    </section>
  )
}
