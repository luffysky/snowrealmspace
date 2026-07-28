'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { ProviderKey } from '@/lib/integrations/providers'
import { extractFigmaKeys } from '@/lib/integrations/figma-url'

/** 對應 GET /api/integrations/{connectionId}/files 的回傳（route.ts 的 IntegrationFile）。 */
type PickerFile = {
  externalId: string
  title: string
  thumbnailUrl: string | null
  updatedAt: string | null
  syncedAt: string | null
}

type FetchResult<T> = { ok: true; data: T } | { ok: false; message: string }

async function apiGet<T>(url: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url)
    const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null
    if (!res.ok || !json || json.error) return { ok: false, message: json?.error?.message ?? `HTTP ${res.status}` }
    return { ok: true, data: json.data as T }
  } catch (err) {
    return { ok: false, message: `網路錯誤：${(err as Error).message}` }
  }
}

async function apiPostJson<T>(url: string, body: unknown): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null
    if (!res.ok || !json || json.error) return { ok: false, message: json?.error?.message ?? `HTTP ${res.status}` }
    return { ok: true, data: json.data as T }
  } catch (err) {
    return { ok: false, message: `網路錯誤：${(err as Error).message}` }
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('zh-TW')
}

const MAX_SELECT = 50

/**
 * S4 檔案選擇器：挑選某條連線可同步的檔案，POST /sync 入列背景同步。
 *
 * Figma：Figma REST API 沒有「列出我所有檔案」的端點，同步單一檔案只需要 file key。
 *   - 主要路徑：**貼檔案連結**（textarea）→ extractFigmaKeys 抽出 key → 直接 POST /sync，
 *     完全跳過列檔呼叫（不必知道專案 ID）。
 *   - 次要路徑（可折疊「進階：用專案 ID 瀏覽」）：填專案 ID → listFiles 勾選，供想瀏覽整個
 *     專案的進階使用者，保留不移除。
 * Canva：能直接列出設計，開啟即載入、勾選同步（行為不變）。
 *
 * 沒有「全選 / 同步全部」——一次最多 50 個（與 API 限制一致）。
 * 誠實狀態：載入中 / 空 / 錯誤 / 沒抽到 key 各自可見；失敗一律顯示 API 訊息。
 * 版面用 .sr-dialog（max-width + max-height:85vh + overflow）—— 行動裝置安全。
 */
export function FilePickerDialog({
  connectionId,
  provider,
  label,
  onClose,
}: {
  connectionId: string
  provider: ProviderKey
  label: string
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)

  // 進階路徑（Canva 直接用）：專案 ID → 列檔勾選
  const [container, setContainer] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<PickerFile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Figma 主要路徑：貼連結 → 抽 key
  const [pasteText, setPasteText] = useState('')
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const pastedKeys = useMemo(
    () => extractFigmaKeys(pasteText).filter((k) => !removed.has(k)),
    [pasteText, removed],
  )

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{ accepted: number; total: number } | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    const qs = new URLSearchParams()
    if (provider === 'figma' && container.trim()) qs.set('container', container.trim())
    const url = `/api/integrations/${connectionId}/files${qs.toString() ? `?${qs.toString()}` : ''}`
    const r = await apiGet<{ files: PickerFile[]; nextCursor: string | null }>(url)
    if (!r.ok) {
      setError(r.message)
      setFiles([])
      setLoaded(true)
      setLoading(false)
      return
    }
    setFiles(r.data.files)
    setSelected(new Set())
    setLoaded(true)
    setLoading(false)
  }, [connectionId, provider, container])

  // Canva 不需 container → 一開啟就載入；Figma 改走貼連結，進階路徑才按「載入檔案」
  useEffect(() => {
    if (provider === 'canva') void load()
  }, [provider, load])

  function toggle(externalId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(externalId)) next.delete(externalId)
      else next.add(externalId)
      return next
    })
  }

  function removeKey(key: string) {
    setRemoved((prev) => new Set(prev).add(key))
  }

  // 共用送出：把明確挑好的 externalIds 入列背景同步
  async function submitIds(ids: string[], onSuccess?: () => void) {
    if (ids.length < 1 || ids.length > MAX_SELECT || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const r = await apiPostJson<{ accepted: number; total: number }>(
      `/api/integrations/${connectionId}/sync`,
      { externalIds: ids },
    )
    setSubmitting(false)
    if (!r.ok) {
      setSubmitError(r.message)
      return
    }
    setResult({ accepted: r.data.accepted, total: ids.length })
    onSuccess?.()
  }

  if (!mounted) return null

  // 進階/Canva 的勾選計數
  const count = selected.size
  const tooMany = count > MAX_SELECT
  const canSubmit = count >= 1 && !tooMany && !submitting

  // Figma 貼連結的計數
  const pasteCount = pastedKeys.length
  const pasteTooMany = pasteCount > MAX_SELECT
  const canSubmitPaste = pasteCount >= 1 && !pasteTooMany && !submitting

  // 列檔狀態 + 清單（Canva 直接用；Figma 進階路徑用）—— 抽成變數避免重複
  const browsePanel = (
    <>
      {loading && (
        <p className="sr-muted" role="status" style={{ margin: 'var(--sr-space-2) 0' }}>載入檔案中…</p>
      )}

      {!loading && error && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 'var(--sr-space-2) 0' }}>
          ✕ {error}
        </p>
      )}

      {!loading && !error && loaded && files.length === 0 && (
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0' }}>目前沒有可同步的檔案。</p>
      )}

      {!loading && files.length > 0 && (
        <ul
          className="sr-stack"
          style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: '4px', maxHeight: '38vh', overflowY: 'auto' }}
        >
          {files.map((f) => (
            <li key={f.externalId}>
              <label
                className="sr-row"
                style={{
                  gap: 'var(--sr-space-2)',
                  alignItems: 'center',
                  padding: 'var(--sr-space-2)',
                  borderRadius: 'var(--sr-radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  style={{ flexShrink: 0 }}
                  checked={selected.has(f.externalId)}
                  onChange={() => toggle(f.externalId)}
                />
                {f.thumbnailUrl ? (
                  <img
                    src={f.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={{
                      width: 44,
                      height: 44,
                      objectFit: 'cover',
                      maxWidth: '100%',
                      flexShrink: 0,
                      borderRadius: 'var(--sr-radius-sm)',
                      border: 'var(--sr-border-width) solid var(--sr-border)',
                    }}
                  />
                ) : (
                  <span className="sr-asset-placeholder" aria-hidden="true" style={{ flexShrink: 0 }}>…</span>
                )}
                <span style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{f.title || f.externalId}</strong>
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                    {f.updatedAt ? `更新於 ${formatDate(f.updatedAt)}` : '更新時間未知'}
                    {' · '}
                    {f.syncedAt ? `上次同步 ${formatDate(f.syncedAt)}` : '尚未同步'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 'var(--sr-space-2) 0 0' }}>
          已選 {count} 個{tooMany ? `（一次最多 ${MAX_SELECT} 個，請減少）` : count === 0 ? '（至少選 1 個）' : ''}
        </p>
      )}
    </>
  )

  return createPortal(
    <div className="sr-dialog-scrim" onClick={onClose}>
      <div
        className="sr-dialog sr-dialog-picker"
        role="dialog"
        aria-modal="true"
        aria-label={`選擇要同步的 ${label} 檔案`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sr-dialog-title">選擇檔案同步 · {label}</h2>

        {/* 成功：入列結果 + 前往作品庫（兩條路徑共用） */}
        {result && (
          <p className="sr-message sr-message-success" role="status" style={{ margin: '0 0 var(--sr-space-3)' }}>
            ✓ 已排入 {result.accepted} 個檔案的背景同步
            {result.total !== result.accepted ? `（共選 ${result.total} 個）` : ''}
            ，完成後可在『作品庫』看到版本。{' '}
            <Link href="/works" className="sr-link">在作品庫比較版本 →</Link>
          </p>
        )}

        {/* 送出錯誤（兩條路徑共用） */}
        {submitError && (
          <p className="sr-message sr-message-error" role="alert" style={{ margin: '0 0 var(--sr-space-3)' }}>
            ✕ {submitError}
          </p>
        )}

        {provider === 'figma' ? (
          <>
            {/* 主要路徑：貼 Figma 檔案連結 */}
            <label className="sr-field" style={{ margin: '0 0 var(--sr-space-2)' }}>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>貼 Figma 檔案連結</span>
              <textarea
                className="sr-input"
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: '5rem', resize: 'vertical' }}
                placeholder={'https://www.figma.com/design/<檔案 key>/檔名\n可多個，一行一個'}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value)
                  setResult(null)
                  setSubmitError(null)
                }}
              />
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                在 Figma 開啟檔案 → 複製網址 → 貼上，可多個、一行一個。
              </span>
            </label>

            {/* 貼了但沒抽到 → 提示（誠實狀態，不靜默） */}
            {pasteText.trim() !== '' && pasteCount === 0 && (
              <p className="sr-muted" style={{ margin: '0 0 var(--sr-space-2)' }}>
                沒有辨識到 Figma 檔案連結或 key。請確認網址像 figma.com/file/… 或 /design/…。
              </p>
            )}

            {/* 抽到的 key：可檢視 / 移除後再同步 */}
            {pasteCount > 0 && (
              <div style={{ margin: '0 0 var(--sr-space-2)' }}>
                <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: '0 0 var(--sr-space-1)' }}>
                  辨識到 {pasteCount} 個檔案{pasteTooMany ? `（一次最多 ${MAX_SELECT} 個，請減少）` : ''}
                </p>
                <ul
                  className="sr-stack"
                  style={{ listStyle: 'none', margin: 0, padding: 0, gap: '4px', maxHeight: '30vh', overflowY: 'auto' }}
                >
                  {pastedKeys.map((k) => (
                    <li key={k}>
                      <div
                        className="sr-row"
                        style={{
                          gap: 'var(--sr-space-2)',
                          alignItems: 'center',
                          padding: 'var(--sr-space-2)',
                          borderRadius: 'var(--sr-radius-sm)',
                          border: 'var(--sr-border-width) solid var(--sr-border)',
                        }}
                      >
                        <code style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere', fontSize: 'var(--sr-text-sm)' }}>{k}</code>
                        <button
                          type="button"
                          className="sr-button sr-button-secondary"
                          style={{ flexShrink: 0, padding: 'var(--sr-space-1) var(--sr-space-2)', fontSize: 'var(--sr-text-sm)' }}
                          onClick={() => removeKey(k)}
                          aria-label={`移除 ${k}`}
                        >
                          移除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'var(--sr-space-2)' }}>
                  <button
                    type="button"
                    className="sr-button"
                    disabled={!canSubmitPaste}
                    onClick={() => void submitIds(pastedKeys, () => setPasteText(''))}
                  >
                    {submitting ? '排入中…' : `同步這些檔案（${pasteCount}）`}
                  </button>
                </div>
              </div>
            )}

            {/* 次要路徑：用專案 ID 瀏覽整個專案（保留給進階使用者） */}
            <details style={{ margin: 'var(--sr-space-2) 0 0' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--sr-text)', fontSize: 'var(--sr-text-sm)' }}>
                進階：用專案 ID 瀏覽
              </summary>
              <div style={{ marginTop: 'var(--sr-space-2)' }}>
                <label className="sr-field" style={{ margin: '0 0 var(--sr-space-2)' }}>
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>Figma 專案 ID</span>
                  <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                    <input
                      className="sr-input"
                      style={{ flex: '1 1 12rem', minWidth: 0 }}
                      placeholder="例如 1234567890"
                      value={container}
                      onChange={(e) => setContainer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && container.trim() && !loading) void load()
                      }}
                    />
                    <button
                      type="button"
                      className="sr-button sr-button-secondary"
                      style={{ flexShrink: 0 }}
                      disabled={!container.trim() || loading}
                      onClick={() => void load()}
                    >
                      {loading ? '載入中…' : loaded ? '重新載入' : '載入檔案'}
                    </button>
                  </div>
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                    在 Figma 開啟專案，網址 /files/project/<strong>&lt;數字&gt;</strong> 的那段就是專案 ID。
                  </span>
                </label>

                {!loading && !error && !loaded && (
                  <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0' }}>
                    填入 Figma 專案 ID 後按「載入檔案」。
                  </p>
                )}

                {browsePanel}

                {files.length > 0 && (
                  <div style={{ marginTop: 'var(--sr-space-2)' }}>
                    <button
                      type="button"
                      className="sr-button"
                      disabled={!canSubmit}
                      onClick={() => void submitIds([...selected], () => setSelected(new Set()))}
                    >
                      {submitting ? '排入中…' : `同步所選（${count}）`}
                    </button>
                  </div>
                )}
              </div>
            </details>
          </>
        ) : (
          // Canva：直接列出設計，勾選同步（行為不變）
          browsePanel
        )}

        <div className="sr-dialog-actions">
          <button type="button" className="sr-button sr-button-secondary" onClick={onClose}>
            關閉
          </button>
          {provider !== 'figma' && files.length > 0 && (
            <button
              type="button"
              className="sr-button"
              disabled={!canSubmit}
              onClick={() => void submitIds([...selected], () => setSelected(new Set()))}
            >
              {submitting ? '排入中…' : `同步所選（${count}）`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
