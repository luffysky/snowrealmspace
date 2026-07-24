'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeTheme,
  suggestFix,
  themeDefinitionSchema,
  defaultThemeDefinition,
  PRESET_THEMES,
  type ThemeDefinition,
  type A11yReport,
} from '@snowrealm/theme-engine'
import { applyThemeToPreview } from '@/lib/theme/apply'
import { ColorField } from './ColorField'
import { SurfaceControls } from './SurfaceControls'
import { A11yPanel } from './A11yPanel'
import { FontPanel } from './FontPanel'
import { ThemePreview } from './ThemePreview'

export type SavedTheme = {
  id: string
  name: string
  definition: ThemeDefinition
  is_favorite: boolean
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string }

const COLOR_FIELDS: { key: keyof ThemeDefinition['colors']; label: string; hint?: string }[] = [
  { key: 'background', label: '背景' },
  { key: 'textPrimary', label: '主要文字' },
  { key: 'textSecondary', label: '次要文字' },
  { key: 'primary', label: '主色' },
  { key: 'accent', label: '強調色' },
  { key: 'secondary', label: '輔色' },
  { key: 'focusRing', label: 'Focus 外框', hint: '鍵盤操作時的外框，必須看得見' },
  { key: 'success', label: '成功' },
  { key: 'warning', label: '警告' },
  { key: 'danger', label: '錯誤' },
]

export function ThemeStudio({
  spaceId,
  initialThemes,
  activeThemeId,
}: {
  spaceId: string
  initialThemes: SavedTheme[]
  activeThemeId: string | null
}) {
  const [themes, setThemes] = useState<SavedTheme[]>(initialThemes)
  const [editingId, setEditingId] = useState<string | null>(activeThemeId)
  const [draft, setDraft] = useState<ThemeDefinition>(
    initialThemes.find((t) => t.id === activeThemeId)?.definition ?? defaultThemeDefinition(),
  )
  const [name, setName] = useState(draft.name)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [dirty, setDirty] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  const report: A11yReport = useMemo(() => analyzeTheme(draft), [draft])

  // 即時預覽：只套用到預覽容器，不影響整個介面
  useEffect(() => {
    if (previewRef.current) applyThemeToPreview(draft, previewRef.current)
  }, [draft])

  const update = useCallback((patch: (prev: ThemeDefinition) => ThemeDefinition) => {
    setDraft((prev) => patch(structuredClone(prev)))
    setDirty(true)
    setStatus({ kind: 'idle' })
  }, [])

  const setColor = useCallback(
    (key: keyof ThemeDefinition['colors'], value: string) => {
      update((d) => {
        d.colors[key] = value
        return d
      })
    },
    [update],
  )

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-space-id': spaceId,
        ...(init?.headers ?? {}),
      },
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。'
      throw new Error(message)
    }
    return (body as { data: unknown }).data
  }

  async function handleSave(asNew: boolean) {
    const validated = themeDefinitionSchema.safeParse({ ...draft, name })
    if (!validated.success) {
      setStatus({
        kind: 'error',
        message: validated.error.issues[0]?.message ?? '主題設定不正確。',
      })
      return
    }

    setStatus({ kind: 'saving' })
    try {
      if (asNew || !editingId) {
        const created = (await api('/api/themes', {
          method: 'POST',
          body: JSON.stringify({ name, definition: validated.data, source: 'manual' }),
        })) as SavedTheme
        setThemes((prev) => [{ ...created, is_favorite: false }, ...prev])
        setEditingId(created.id)
        setStatus({ kind: 'saved', message: '已另存為新主題。' })
      } else {
        const updated = (await api(`/api/themes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, definition: validated.data }),
        })) as SavedTheme
        setThemes((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updated } : t)))
        setStatus({ kind: 'saved', message: '已儲存。' })
      }
      setDirty(false)
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '儲存失敗。' })
    }
  }

  async function handleApply() {
    if (!editingId) {
      setStatus({ kind: 'error', message: '請先儲存主題再套用。' })
      return
    }
    setStatus({ kind: 'saving' })
    try {
      await api(`/api/themes/${editingId}/apply`, { method: 'POST' })
      setStatus({ kind: 'saved', message: '已套用到你的空間。重新整理即可看到。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '套用失敗。' })
    }
  }

  function loadTheme(theme: SavedTheme) {
    setDraft(structuredClone(theme.definition))
    setName(theme.name)
    setEditingId(theme.id)
    setDirty(false)
    setStatus({ kind: 'idle' })
  }

  function loadPreset(preset: ThemeDefinition) {
    setDraft(structuredClone(preset))
    setName(preset.name)
    setEditingId(null) // 內建主題不可覆寫，儲存時會建立新的
    setDirty(true)
    setStatus({ kind: 'idle' })
  }

  function handleReset() {
    const base = defaultThemeDefinition()
    setDraft(base)
    setName(base.name)
    setDirty(true)
  }

  async function handleImport(file: File) {
    setStatus({ kind: 'saving' })
    try {
      const text = await file.text()
      const payload: unknown = JSON.parse(text)
      const created = (await api('/api/themes/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      })) as SavedTheme & { substitutedFonts?: { requested: string; usedInstead: string }[] }

      setThemes((prev) => [created, ...prev])
      loadTheme(created)

      const subs = created.substitutedFonts ?? []
      setStatus({
        kind: 'saved',
        message:
          subs.length > 0
            ? `已匯入。有 ${subs.length} 個字體本地沒有，已替換為預設。`
            : '已匯入。',
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : '這個檔案不是有效的主題。',
      })
    }
  }

  return (
    <div className="sr-studio" data-tour="theme-studio">
      {/* ── 左：控制 ── */}
      <div className="sr-studio-controls sr-stack">
        <section className="sr-card">
          <label className="sr-label" htmlFor="theme-name">
            主題名稱
          </label>
          <input
            id="theme-name"
            className="sr-input"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value)
              setDirty(true)
            }}
          />

          <div className="sr-row" style={{ marginTop: 'var(--sr-space-4)' }}>
            <button className="sr-button" type="button" onClick={() => void handleSave(false)}>
              {editingId ? '儲存' : '建立'}
            </button>
            <button
              className="sr-button sr-button-secondary"
              type="button"
              onClick={() => void handleSave(true)}
            >
              另存新檔
            </button>
            <button
              className="sr-button sr-button-secondary"
              type="button"
              onClick={() => void handleApply()}
              disabled={!editingId || dirty}
              title={dirty ? '請先儲存變更' : undefined}
            >
              套用
            </button>
          </div>

          {status.kind === 'error' && (
            <p className="sr-message sr-message-error" role="alert">
              ✕ {status.message}
            </p>
          )}
          {status.kind === 'saved' && (
            <p className="sr-message sr-message-success" role="status">
              ✓ {status.message}
            </p>
          )}
          {dirty && status.kind === 'idle' && (
            <p className="sr-muted" style={{ marginBottom: 0 }}>
              有未儲存的變更。
            </p>
          )}
        </section>

        <section className="sr-card">
          <h2 className="sr-section-title">顏色</h2>
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              id={`color-${field.key}`}
              label={field.label}
              hint={field.hint}
              value={draft.colors[field.key]}
              onChange={(v) => setColor(field.key, v)}
            />
          ))}
        </section>

        <FontPanel draft={draft} onChange={update} />

        <SurfaceControls draft={draft} onChange={update} />

        <A11yPanel report={report} suggestFix={suggestFix} />

        <section className="sr-card">
          <h2 className="sr-section-title">主題庫</h2>

          <h3 className="sr-subsection-title">你的主題</h3>
          {themes.length === 0 ? (
            <p className="sr-muted">還沒有儲存過主題。</p>
          ) : (
            <ul className="sr-theme-list">
              {themes.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="sr-theme-chip"
                    onClick={() => loadTheme(t)}
                    aria-current={t.id === editingId ? 'true' : undefined}
                  >
                    <span
                      className="sr-swatch-row"
                      aria-hidden="true"
                      style={{
                        // 這是使用者資料的預覽，不是主題 token
                        background: `linear-gradient(90deg, ${t.definition.colors.primary} 0 33%, ${t.definition.colors.accent} 33% 66%, ${t.definition.colors.background} 66%)`,
                      }}
                    />
                    <span>{t.name}</span>
                    {t.id === activeThemeId && <span className="sr-badge">使用中</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="sr-subsection-title">內建</h3>
          <ul className="sr-theme-list">
            {PRESET_THEMES.map((p) => (
              <li key={p.name}>
                <button type="button" className="sr-theme-chip" onClick={() => loadPreset(p)}>
                  <span
                    className="sr-swatch-row"
                    aria-hidden="true"
                    style={{
                      background: `linear-gradient(90deg, ${p.colors.primary} 0 33%, ${p.colors.accent} 33% 66%, ${p.colors.background} 66%)`,
                    }}
                  />
                  <span>{p.name}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="sr-row" style={{ marginTop: 'var(--sr-space-4)' }}>
            <button className="sr-button sr-button-secondary" type="button" onClick={handleReset}>
              還原預設
            </button>
            {editingId && (
              <a
                className="sr-button sr-button-secondary"
                href={`/api/themes/${editingId}/export`}
                download
              >
                匯出 JSON
              </a>
            )}
            <label className="sr-button sr-button-secondary" style={{ cursor: 'pointer' }}>
              匯入 JSON
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImport(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </section>
      </div>

      {/* ── 右：預覽 ── */}
      <div className="sr-studio-preview">
        <ThemePreview ref={previewRef} definition={draft} />
      </div>
    </div>
  )
}
