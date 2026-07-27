'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  analyzeTheme,
  suggestFix,
  themeDefinitionSchema,
  defaultThemeDefinition,
  PRESET_THEMES,
  PRESET_CATEGORY,
  type ThemeDefinition,
  type A11yReport,
} from '@snowrealm/theme-engine'
import { ColorField } from './ColorField'
import { SurfaceControls } from './SurfaceControls'
import { A11yPanel } from './A11yPanel'
import { FontPanel } from './FontPanel'
import { ThemePreview } from './ThemePreview'
import type { BackgroundState } from '@/components/BackgroundLayer'

/** 內建主題分類顯示順序（招牌在前，生成的色系在後）。 */
const PRESET_CATEGORY_ORDER = [
  '淺色柔和',
  '淺色自然',
  '淺色中性',
  '深色',
  '深色中性',
  '鮮彩・淺',
  '柔彩・淺',
  '鮮彩・深',
  '柔彩・深',
  '中性',
  '其他',
]

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
  background,
}: {
  spaceId: string
  initialThemes: SavedTheme[]
  activeThemeId: string | null
  background: BackgroundState | null
}) {
  const [themes, setThemes] = useState<SavedTheme[]>(initialThemes)
  const [editingId, setEditingId] = useState<string | null>(activeThemeId)
  const [draft, setDraft] = useState<ThemeDefinition>(
    initialThemes.find((t) => t.id === activeThemeId)?.definition ?? defaultThemeDefinition(),
  )
  const [name, setName] = useState(draft.name)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [mood, setMood] = useState('')
  const [moodVariants, setMoodVariants] = useState<{ variant: string; definition: ThemeDefinition }[]>([])
  const [moodBusy, setMoodBusy] = useState(false)

  // 內建主題分類 tab（橫式）。只列有主題的分類，預設選第一個。
  const themeCats = useMemo(
    () => PRESET_CATEGORY_ORDER.filter((cat) => PRESET_THEMES.some((p) => (PRESET_CATEGORY[p.name] ?? '其他') === cat)),
    [],
  )
  const [activeCat, setActiveCat] = useState<string>(themeCats[0] ?? '')

  const report: A11yReport = useMemo(() => analyzeTheme(draft), [draft])

  // 即時預覽由 ThemePreview 自己負責套用（含淺/深模式）——這裡不再重複套用，
  // 否則兩個 effect 會互相蓋掉、深色 tab 會被打回淺色。
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

  /** 儲存草稿。回傳存好的 theme id（失敗回 null），讓「儲存並套用」能接著用同一個 id。 */
  async function handleSave(asNew: boolean): Promise<string | null> {
    const validated = themeDefinitionSchema.safeParse({ ...draft, name })
    if (!validated.success) {
      setStatus({
        kind: 'error',
        message: validated.error.issues[0]?.message ?? '主題設定不正確。',
      })
      return null
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
        setDirty(false)
        return created.id
      } else {
        const updated = (await api(`/api/themes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, definition: validated.data }),
        })) as SavedTheme
        setThemes((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updated } : t)))
        setStatus({ kind: 'saved', message: '已儲存。' })
        setDirty(false)
        return editingId
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '儲存失敗。' })
      return null
    }
  }

  async function applyThemeId(id: string) {
    setStatus({ kind: 'saving' })
    try {
      await api(`/api/themes/${id}/apply`, { method: 'POST' })
      setStatus({ kind: 'saved', message: '已套用到你的空間。重新整理即可看到。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '套用失敗。' })
    }
  }

  async function handleApply() {
    if (!editingId) {
      setStatus({ kind: 'error', message: '請先儲存主題再套用。' })
      return
    }
    await applyThemeId(editingId)
  }

  /** 一鍵儲存並套用 —— 消除「先存再套」兩步的困惑（字體/顏色改完直接生效）。 */
  async function handleSaveAndApply() {
    const id = await handleSave(false)
    if (id) await applyThemeId(id)
  }

  function loadTheme(theme: SavedTheme) {
    setDraft(structuredClone(theme.definition))
    setName(theme.name)
    setEditingId(theme.id)
    setDirty(false)
    setStatus({ kind: 'idle' })
  }

  // 匯出走 fetch（帶 x-space-id）再觸發下載——用 <a download> 會少了 header、
  // resolveContext 失敗回 401，下載到的是錯誤 JSON 而不是主題檔。
  async function handleExport() {
    if (!editingId) return
    try {
      const res = await fetch(`/api/themes/${editingId}/export`, {
        headers: { 'x-space-id': spaceId },
      })
      if (!res.ok) {
        setStatus({ kind: 'error', message: '匯出失敗，請稍後再試。' })
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = match?.[1] ?? `theme-${editingId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setStatus({ kind: 'error', message: '匯出失敗，請稍後再試。' })
    }
  }

  function loadPreset(preset: ThemeDefinition) {
    setDraft(structuredClone(preset))
    setName(preset.name)
    setEditingId(null) // 內建主題不可覆寫，儲存時會建立新的
    setDirty(true)
    setStatus({ kind: 'idle' })
  }

  /**
   * 內建主題「一鍵套用」：載進預覽 + 直接建立/更新為儲存主題並套用到空間。
   * 同名的內建主題重用同一列，避免每點一次就多一筆。之後改參數再用「儲存並套用」。
   */
  async function applyPreset(preset: ThemeDefinition) {
    loadPreset(preset)
    setStatus({ kind: 'saving' })
    try {
      const existing = themes.find((t) => t.name === preset.name)
      let id: string
      if (existing) {
        const updated = (await api(`/api/themes/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: preset.name, definition: preset }),
        })) as SavedTheme
        setThemes((prev) => prev.map((t) => (t.id === existing.id ? { ...t, ...updated } : t)))
        id = existing.id
      } else {
        const created = (await api('/api/themes', {
          method: 'POST',
          body: JSON.stringify({ name: preset.name, definition: preset, source: 'manual' }),
        })) as SavedTheme
        setThemes((prev) => [{ ...created, is_favorite: false }, ...prev])
        id = created.id
      }
      setEditingId(id)
      setDirty(false)
      await api(`/api/themes/${id}/apply`, { method: 'POST' })
      setStatus({ kind: 'saved', message: `已套用「${preset.name}」。重新整理即可看到。` })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '套用失敗。' })
    }
  }

  // AI 配色：心情 → 三套變體（本地演算法，對比保證）；點一套只換顏色，保留名稱與字型。
  async function generateFromMood() {
    const m = mood.trim()
    if (!m) return
    setMoodBusy(true)
    setStatus({ kind: 'idle' })
    try {
      const data = (await api('/api/themes/from-mood', {
        method: 'POST',
        body: JSON.stringify({ mood: m }),
      })) as { variants: { variant: string; definition: ThemeDefinition }[] }
      setMoodVariants(data.variants)
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'AI 配色失敗。' })
    } finally {
      setMoodBusy(false)
    }
  }

  function applyMoodVariant(def: ThemeDefinition) {
    update((d) => {
      d.colors = structuredClone(def.colors)
      return d
    })
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
        {/* 隨捲動固定的存檔列 —— 手機上控制項很長，改完字體往下捲也永遠看得到怎麼存 */}
        <div className="sr-studio-savebar">
          <button className="sr-button" type="button" onClick={() => void handleSaveAndApply()}>
            儲存並套用
          </button>
          {dirty ? (
            <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>有未儲存的變更</span>
          ) : status.kind === 'saved' ? (
            <span className="sr-message-success" style={{ fontSize: 'var(--sr-text-sm)' }}>✓ 已套用</span>
          ) : null}
        </div>
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

          <div className="sr-row" style={{ marginTop: 'var(--sr-space-4)', flexWrap: 'wrap' }}>
            <button
              className="sr-button"
              type="button"
              onClick={() => void handleSaveAndApply()}
              title="儲存這套設定並立刻套用到你的空間"
            >
              儲存並套用
            </button>
            <button className="sr-button sr-button-secondary" type="button" onClick={() => void handleSave(false)}>
              {editingId ? '只儲存' : '建立'}
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
          <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', fontSize: 'var(--sr-text-sm)' }}>
            改好字體/顏色後按「<strong>儲存並套用</strong>」就會生效。只是預覽的話不會保留。
          </p>

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
          <h2 className="sr-section-title">AI 配色</h2>
          <p className="sr-muted" style={{ marginTop: 0 }}>
            打一個心情或關鍵字（海洋、森林、夜晚、櫻花…），自動配一組顏色，套用後仍可微調。
          </p>
          <div className="sr-row">
            <input
              className="sr-input"
              value={mood}
              maxLength={40}
              placeholder="例如：海洋、森林、夜晚…"
              onChange={(e) => setMood(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void generateFromMood()
              }}
              aria-label="配色心情關鍵字"
            />
            <button
              type="button"
              className="sr-button"
              onClick={() => void generateFromMood()}
              disabled={moodBusy || !mood.trim()}
            >
              {moodBusy ? '生成中…' : '生成'}
            </button>
          </div>
          {moodVariants.length > 0 && (
            <div className="sr-row" style={{ marginTop: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
              {moodVariants.map((v) => (
                <button
                  key={v.variant}
                  type="button"
                  className="sr-button sr-button-secondary"
                  onClick={() => applyMoodVariant(v.definition)}
                  title={`套用「${v.variant}」配色`}
                >
                  <span style={{ display: 'inline-flex', gap: 2, marginRight: 6, verticalAlign: 'middle' }}>
                    {[v.definition.colors.primary, v.definition.colors.accent, v.definition.colors.background].map(
                      (c, i) => (
                        <span
                          key={i}
                          style={{ width: 12, height: 12, borderRadius: 3, background: c, border: '1px solid var(--sr-border)' }}
                        />
                      ),
                    )}
                  </span>
                  {v.variant}
                </button>
              ))}
            </div>
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
          <p className="sr-muted" style={{ marginTop: 0, fontSize: 'var(--sr-text-xs)' }}>
            點一下＝直接套用到你的空間（重新整理生效）。之後再改參數就用「儲存並套用」。
          </p>
          <div className="sr-cat-tabs" role="tablist" aria-label="主題分類">
            {themeCats.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCat === cat}
                className={`sr-cat-tab ${activeCat === cat ? 'is-active' : ''}`}
                onClick={() => setActiveCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <ul className="sr-theme-list" style={{ marginTop: 'var(--sr-space-3)' }}>
            {PRESET_THEMES.filter((p) => (PRESET_CATEGORY[p.name] ?? '其他') === activeCat).map((p) => (
              <li key={p.name}>
                <button type="button" className="sr-theme-chip" onClick={() => void applyPreset(p)}>
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
              <button
                className="sr-button sr-button-secondary"
                type="button"
                onClick={() => void handleExport()}
              >
                匯出 JSON
              </button>
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
        <ThemePreview definition={draft} spaceId={spaceId} background={background} />
      </div>
    </div>
  )
}
