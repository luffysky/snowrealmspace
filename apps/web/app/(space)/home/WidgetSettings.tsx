'use client'

import { useEffect, useMemo, useState } from 'react'
import { editableConfigFields, type ConfigField, type WidgetId } from '@snowrealm/widget-engine'
import { SCENE_CATEGORIES, scenesByCategory, type SceneCategory } from '@/lib/scenes'

type ProjectOption = { id: string; name: string }

/**
 * 單一 widget 的設定面板。從 configSchema 自動生成（config-fields.ts）。
 *
 * 涵蓋 06-widget-contract.md 的三件事：
 *   - 設定（config）：依 schema 型別渲染控制項
 *   - 隱藏（hidden）：暫時不顯示但保留設定，不是刪除
 *   - 鎖定（locked）：編輯版面時不會被拖動或改大小
 *
 * 隱藏與刪除的差別要說清楚：隱藏留著設定，刪除是真的移除。
 */

type EditableField = Exclude<ConfigField, { kind: 'unsupported' }>

export function WidgetSettings({
  spaceId,
  widgetName,
  definitionId,
  config,
  hidden,
  locked,
  onSave,
  onToggleHidden,
  onToggleLocked,
  onClose,
}: {
  spaceId: string
  widgetName: string
  definitionId: string
  config: Record<string, unknown>
  hidden: boolean
  locked: boolean
  onSave: (config: Record<string, unknown>) => void
  onToggleHidden: (hidden: boolean) => void
  onToggleLocked: (locked: boolean) => void
  onClose: () => void
}) {
  const fields = useMemo(
    () => editableConfigFields(definitionId as WidgetId),
    [definitionId],
  )

  // 有專案參照欄位時才載入專案清單（給下拉選單）
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const needsProjects = fields.some((f) => f.kind === 'project')
  useEffect(() => {
    if (!needsProjects) return
    let alive = true
    fetch('/api/projects', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: ProjectOption[] }) => {
        if (alive) setProjects(b.data ?? [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [needsProjects, spaceId])

  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    // 以 schema 預設為底，蓋上已存的值 —— 缺欄位時控制項才有初值
    const base: Record<string, unknown> = {}
    for (const field of fields) base[field.key] = field.default
    return { ...base, ...config }
  })
  const [dirty, setDirty] = useState(false)

  function set(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  return (
    <div className="sr-card sr-widget-settings" role="group" aria-label={`${widgetName} 設定`}>
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <h3 className="sr-subsection-title" style={{ margin: 0 }}>
          {widgetName}
        </h3>
        <button type="button" className="sr-asset-delete" onClick={onClose} aria-label="關閉設定">
          ✕
        </button>
      </div>

      {/* ── 顯示狀態 ── */}
      <div className="sr-field">
        <label className="sr-checkbox">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => onToggleHidden(e.target.checked)}
          />
          <span>
            隱藏這個區塊
            <span className="sr-muted"> —— 暫時不顯示，但保留設定。與移除不同。</span>
          </span>
        </label>
        <label className="sr-checkbox">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => onToggleLocked(e.target.checked)}
          />
          <span>
            鎖定位置
            <span className="sr-muted"> —— 編輯版面時不會被拖動或改大小。</span>
          </span>
        </label>
      </div>

      {/* ── 設定欄位（自動生成）── */}
      {fields.length === 0 ? (
        <p className="sr-muted">這個區塊沒有可調整的設定。</p>
      ) : (
        <div className="sr-field">
          {fields.map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={draft[field.key]}
              projects={projects}
              onChange={(v) => set(field.key, v)}
            />
          ))}
        </div>
      )}

      {/* ── 相框專屬：從素材庫挑一張圖（存進 config.assetId）── */}
      {definitionId === 'photo_frame' && (
        <AssetPicker
          spaceId={spaceId}
          value={typeof draft.assetId === 'string' ? draft.assetId : ''}
          onChange={(id) => set('assetId', id)}
        />
      )}

      {/* ── 背景（自訂，非 schema 欄位；存進 config.bg）── */}
      <BackgroundPicker
        value={typeof draft.bg === 'string' ? draft.bg : undefined}
        onChange={(id) => set('bg', id)}
        animate={draft.bgAnimate === true}
        onAnimateChange={(v) => set('bgAnimate', v)}
        opacity={typeof draft.bgOpacity === 'number' ? draft.bgOpacity : 0.5}
        onOpacityChange={(v) => set('bgOpacity', v)}
      />

      <button
        type="button"
        className="sr-button"
        disabled={!dirty}
        onClick={() => {
          onSave(draft)
          setDirty(false)
        }}
      >
        {dirty ? '儲存設定' : '已儲存'}
      </button>
    </div>
  )
}

/**
 * 背景挑選器：從內建場景庫（約 300 個程序生成場景）替這個 widget 選一個背景。
 * 不是 schema 欄位，直接寫進 config 的自由鍵 `bg`。預設「無背景」。
 * swatch 用場景的 `base`（CSS 漸層）當靜態預覽，不在挑選器裡跑動畫。
 */
function BackgroundPicker({
  value,
  onChange,
  animate,
  onAnimateChange,
  opacity,
  onOpacityChange,
}: {
  value: string | undefined
  onChange: (id: string | null) => void
  animate: boolean
  onAnimateChange: (v: boolean) => void
  opacity: number
  onOpacityChange: (v: number) => void
}) {
  const [cat, setCat] = useState<SceneCategory>(SCENE_CATEGORIES[0] ?? '天氣')
  const scenes = useMemo(() => scenesByCategory(cat), [cat])

  return (
    <div className="sr-field sr-bg-picker" style={{ minWidth: 0, maxWidth: '100%' }}>
      <span className="sr-label">背景</span>

      {/* 無背景籤 */}
      <div className="sr-chip-row">
        <button
          type="button"
          className={`sr-chip${value === undefined ? ' sr-chip-active' : ''}`}
          aria-pressed={value === undefined}
          onClick={() => onChange(null)}
        >
          無背景
        </button>
      </div>

      {/* 分類籤 */}
      <div className="sr-chip-row" role="tablist" aria-label="背景分類">
        {SCENE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === cat}
            className={`sr-chip${c === cat ? ' sr-chip-active' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 場景 swatch 網格 */}
      <div
        className="sr-bg-swatches"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
          gap: 'var(--sr-space-2)',
          minWidth: 0,
        }}
      >
        {scenes.map((scene) => {
          const selected = value === scene.id
          return (
            <button
              key={scene.id}
              type="button"
              className="sr-bg-swatch"
              aria-pressed={selected}
              aria-label={scene.label}
              title={scene.label}
              data-selected={selected ? '' : undefined}
              onClick={() => onChange(scene.id)}
              style={{
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '2px',
                borderRadius: 'var(--sr-radius-sm)',
                border: selected
                  ? '2px solid var(--sr-accent)'
                  : '1px solid var(--sr-border)',
                background: 'var(--sr-surface-alt)',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  height: '36px',
                  borderRadius: 'calc(var(--sr-radius-sm) - 2px)',
                  background: scene.base,
                }}
              />
              <span
                className="sr-muted"
                style={{
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {scene.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 選了背景才顯示：會不會動（預設靜態）+ 透明度滑桿 */}
      {value !== undefined && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sr-space-2)',
            marginTop: 'var(--sr-space-1)',
          }}
        >
          <label className="sr-checkbox">
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => onAnimateChange(e.target.checked)}
            />
            <span>背景會動（預設靜態）</span>
          </label>
          <label
            className="sr-label"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sr-space-2)' }}
          >
            <span style={{ flexShrink: 0 }}>透明度</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
              aria-label="背景透明度"
            />
          </label>
        </div>
      )}
    </div>
  )
}

/**
 * 相框圖片挑選器：列出素材庫的圖片，選一張存進 config.assetId。
 * 非 schema 欄位（assetId 在 config-fields.ts 標為 unsupported，通用表單跳過），
 * 由這裡專門處理 —— 就像 BackgroundPicker 之於 config.bg。
 *
 * private bucket：縮圖走短期 signed URL（/api/assets/:id/url?rendition=thumbnail），
 * 與 library/AssetGrid 的做法一致。
 */
function AssetPicker({
  spaceId,
  value,
  onChange,
}: {
  spaceId: string
  value: string
  onChange: (id: string) => void
}) {
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([])
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/assets?kind=image', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { id: string; original_filename: string | null }[] }) => {
        if (!alive) return
        setAssets(b.data.map((a) => ({ id: a.id, name: a.original_filename ?? '未命名' })))
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  return (
    <div className="sr-field" style={{ minWidth: 0, maxWidth: '100%' }}>
      <span className="sr-label">相框圖片</span>

      {state === 'loading' && <p className="sr-muted" style={{ margin: 0 }}>載入中…</p>}
      {state === 'error' && (
        <p className="sr-muted" style={{ margin: 0, color: 'var(--sr-danger)' }}>
          讀不到圖片清單，請重新整理。
        </p>
      )}
      {state === 'idle' && assets.length === 0 && (
        <p className="sr-muted" style={{ margin: 0 }}>
          素材庫還沒有圖片。先到「素材庫」上傳一張。
        </p>
      )}

      {state === 'idle' && assets.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
            gap: 'var(--sr-space-2)',
            minWidth: 0,
          }}
        >
          {assets.map((a) => (
            <AssetThumb
              key={a.id}
              spaceId={spaceId}
              assetId={a.id}
              name={a.name}
              selected={value === a.id}
              onClick={() => onChange(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 單張縮圖：自己取短期 signed URL（thumbnail），點選即設為相框圖片。 */
function AssetThumb({
  spaceId,
  assetId,
  name,
  selected,
  onClick,
}: {
  spaceId: string
  assetId: string
  name: string
  selected: boolean
  onClick: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/assets/${assetId}/url?rendition=thumbnail`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { url: string } }) => {
        if (!cancelled) setUrl(b.data.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, assetId])

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={name}
      title={name}
      onClick={onClick}
      style={{
        minWidth: 0,
        padding: '2px',
        borderRadius: 'var(--sr-radius-sm)',
        border: selected ? '2px solid var(--sr-accent)' : '1px solid var(--sr-border)',
        background: 'var(--sr-surface-alt)',
        cursor: 'pointer',
        aspectRatio: '1 / 1',
        overflow: 'hidden',
      }}
    >
      {url ? (
        // signed URL 是動態短期的，不走 next/image 最佳化管線
        <img
          src={url}
          alt=""
          loading="lazy"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span className="sr-muted" style={{ fontSize: '11px' }} aria-hidden="true">
          …
        </span>
      )}
    </button>
  )
}

function FieldControl({
  field,
  value,
  projects,
  onChange,
}: {
  field: EditableField
  value: unknown
  projects: ProjectOption[]
  onChange: (value: unknown) => void
}) {
  const id = `cfg-${field.key}`

  if (field.kind === 'project') {
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
        </label>
        <select
          id={id}
          className="sr-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">（不綁定）</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.kind === 'boolean') {
    return (
      <label className="sr-checkbox">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  if (field.kind === 'number') {
    const num = typeof value === 'number' ? value : field.default
    // 有明確 min+max 且範圍不大時用滑桿，否則用數字框
    const useSlider = field.min !== undefined && field.max !== undefined && field.max - field.min <= 60
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
          {useSlider && <span className="sr-muted"> {num}</span>}
        </label>
        <input
          id={id}
          type={useSlider ? 'range' : 'number'}
          className={useSlider ? undefined : 'sr-input'}
          value={num}
          {...(field.min !== undefined ? { min: field.min } : {})}
          {...(field.max !== undefined ? { max: field.max } : {})}
          step={field.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    )
  }

  if (field.kind === 'date') {
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
        </label>
        <input
          id={id}
          type="date"
          className="sr-input"
          value={typeof value === 'string' ? value : field.default}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 0, maxWidth: '100%' }}
        />
      </div>
    )
  }

  if (field.kind === 'enum') {
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
        </label>
        <select
          id={id}
          className="sr-input"
          value={typeof value === 'string' ? value : field.default}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // string
  // 「一行一項」的欄位（每日情話 phrases、幸運籤 fortunes、骰子自訂 options）
  // 用多行 textarea，其餘用單行輸入。
  const multiline = field.key === 'phrases' || field.key === 'fortunes' || field.key === 'options'
  return (
    <div className="sr-field-row">
      <label className="sr-label" htmlFor={id}>
        {field.label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="sr-input"
          rows={4}
          value={typeof value === 'string' ? value : field.default}
          {...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {})}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 0, maxWidth: '100%', resize: 'vertical' }}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="sr-input"
          value={typeof value === 'string' ? value : field.default}
          {...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {})}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
